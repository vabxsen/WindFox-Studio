//! JSON-lines protocol between the UI process and the elevated worker, plus
//! the UI-side client that starts the worker on first use and keeps it alive.

use crate::elevation;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, ReadHalf, WriteHalf};
use tokio::net::windows::named_pipe::{NamedPipeServer, ServerOptions};
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "op", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum Request {
    InstallApp { app_id: String },
    CreateRestorePoint,
    ScanDrivers,
    InstallDrivers { update_ids: Vec<String> },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Reply {
    Progress { payload: Value },
    Done { payload: Value },
    Error { message: String },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequestEnvelope {
    pub id: u64,
    pub request: Request,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReplyEnvelope {
    pub id: u64,
    pub reply: Reply,
}

struct Connection {
    reader: BufReader<ReadHalf<NamedPipeServer>>,
    writer: WriteHalf<NamedPipeServer>,
}

/// Owns the connection to the elevated worker. One request runs at a time.
pub struct WorkerClient {
    connection: Mutex<Option<Connection>>,
    next_id: AtomicU64,
    owner_hwnd: std::sync::atomic::AtomicIsize,
}

impl Default for WorkerClient {
    fn default() -> Self {
        Self {
            connection: Mutex::new(None),
            next_id: AtomicU64::new(1),
            owner_hwnd: std::sync::atomic::AtomicIsize::new(0),
        }
    }
}

impl WorkerClient {
    pub fn set_owner_window(&self, hwnd: isize) {
        self.owner_hwnd.store(hwnd, Ordering::Relaxed);
    }

    /// Sends one request and waits for its result. Progress replies are passed
    /// to `on_progress`. Starts the worker (one UAC prompt) if needed.
    pub async fn call(
        &self,
        request: Request,
        mut on_progress: impl FnMut(Value) + Send,
    ) -> Result<Value, String> {
        let mut guard = self.connection.lock().await;
        if guard.is_none() {
            *guard = Some(self.start().await?);
        }
        let connection = guard.as_mut().expect("connection was just set");

        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let mut line = serde_json::to_string(&RequestEnvelope { id, request })
            .map_err(|e| e.to_string())?;
        line.push('\n');
        if let Err(e) = connection.writer.write_all(line.as_bytes()).await {
            *guard = None;
            return Err(format!("Lost contact with the helper: {e}"));
        }

        loop {
            let mut buf = String::new();
            match connection.reader.read_line(&mut buf).await {
                Ok(0) | Err(_) => {
                    *guard = None;
                    return Err("The helper stopped unexpectedly.".into());
                }
                Ok(_) => {}
            }
            let Ok(envelope) = serde_json::from_str::<ReplyEnvelope>(buf.trim_end()) else {
                log::warn!("ignoring malformed reply from helper: {}", buf.trim_end());
                continue;
            };
            if envelope.id != id {
                continue;
            }
            match envelope.reply {
                Reply::Progress { payload } => on_progress(payload),
                Reply::Done { payload } => return Ok(payload),
                Reply::Error { message } => return Err(message),
            }
        }
    }

    async fn start(&self) -> Result<Connection, String> {
        let pipe_name = format!(r"\\.\pipe\windfox-{}-{:x}", std::process::id(), random_suffix());
        let server = ServerOptions::new()
            .first_pipe_instance(true)
            .reject_remote_clients(true)
            .create(&pipe_name)
            .map_err(|e| format!("Couldn't open a channel to the helper: {e}"))?;

        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let owner = self.owner_hwnd.load(Ordering::Relaxed);
        let name = pipe_name.clone();
        log::info!("starting elevated helper: {exe:?} on {pipe_name}");
        tokio::task::spawn_blocking(move || elevation::launch_worker(&exe, &name, owner))
            .await
            .map_err(|e| e.to_string())?
            .inspect_err(|e| log::warn!("helper launch failed: {e}"))?;

        tokio::time::timeout(Duration::from_secs(30), server.connect())
            .await
            .map_err(|_| "The helper didn't respond in time.".to_string())
            .and_then(|r| r.map_err(|e| format!("The helper couldn't connect: {e}")))
            .inspect_err(|e| log::warn!("{e}"))?;

        log::info!("elevated helper connected on {pipe_name}");
        let (read, write) = tokio::io::split(server);
        Ok(Connection { reader: BufReader::new(read), writer: write })
    }
}

/// Unpredictable enough to stop another process from guessing the pipe name.
fn random_suffix() -> u64 {
    use std::collections::hash_map::RandomState;
    use std::hash::{BuildHasher, Hasher};
    let mut hasher = RandomState::new().build_hasher();
    hasher.write_u128(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or_default(),
    );
    hasher.finish()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_round_trips_as_json() {
        let envelope = RequestEnvelope {
            id: 7,
            request: Request::InstallApp { app_id: "Valve.Steam".into() },
        };
        let json = serde_json::to_string(&envelope).unwrap();
        assert_eq!(json, r#"{"id":7,"request":{"op":"installApp","appId":"Valve.Steam"}}"#);
        let back: RequestEnvelope = serde_json::from_str(&json).unwrap();
        assert_eq!(back.request, envelope.request);
    }

    #[test]
    fn reply_round_trips_as_json() {
        let json = r#"{"id":1,"reply":{"kind":"error","message":"nope"}}"#;
        let envelope: ReplyEnvelope = serde_json::from_str(json).unwrap();
        assert_eq!(envelope.reply, Reply::Error { message: "nope".into() });
    }
}

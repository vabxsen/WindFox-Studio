//! Runs a batch of app installs one after another and reports progress to
//! the UI through `install-progress` and `install-finished` events.

use crate::catalog::{catalog, CatalogApp};
use crate::elevation::DECLINED_MESSAGE;
use crate::ipc::{Request, WorkerClient};
use crate::winget::{self, InstallOutcome, InstallState};
use serde::Serialize;
use std::collections::HashSet;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallProgress {
    pub id: String,
    pub state: InstallState,
    pub message: String,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallSummary {
    pub installed: usize,
    pub already_installed: usize,
    pub failed: usize,
    pub reboot_required: bool,
    pub simulated: bool,
}

impl InstallSummary {
    fn add(&mut self, state: InstallState) {
        match state {
            InstallState::Installed => self.installed += 1,
            InstallState::AlreadyInstalled => self.already_installed += 1,
            InstallState::RebootRequired => {
                self.installed += 1;
                self.reboot_required = true;
            }
            InstallState::Failed => self.failed += 1,
            InstallState::Queued | InstallState::Installing => {}
        }
    }
}

fn emit(app: &AppHandle, id: &str, state: InstallState, message: impl Into<String>) {
    let _ = app.emit(
        "install-progress",
        InstallProgress { id: id.to_string(), state, message: message.into() },
    );
}

/// Catalog apps for the requested IDs, in order, without duplicates.
pub fn resolve(ids: &[String]) -> (Vec<CatalogApp>, Vec<String>) {
    let mut seen = HashSet::new();
    let mut apps = Vec::new();
    let mut unknown = Vec::new();
    for id in ids {
        if !seen.insert(id.to_ascii_lowercase()) {
            continue;
        }
        match catalog().find(id) {
            Some(app) => apps.push(app.clone()),
            None => unknown.push(id.clone()),
        }
    }
    (apps, unknown)
}

pub async fn run_batch(
    app: AppHandle,
    worker: Arc<WorkerClient>,
    ids: Vec<String>,
    simulate: bool,
) -> InstallSummary {
    let (apps, unknown) = resolve(&ids);
    let mut summary = InstallSummary { simulated: simulate, ..Default::default() };

    for id in &unknown {
        emit(&app, id, InstallState::Failed, "This app isn't in the catalog");
        summary.failed += 1;
    }
    for entry in &apps {
        emit(&app, &entry.id, InstallState::Queued, "Waiting");
    }

    // After a declined UAC prompt, don't ask again for every app in the batch.
    let mut declined = false;

    for entry in apps {
        emit(&app, &entry.id, InstallState::Installing, "Installing…");
        let outcome = if simulate || !entry.elevated {
            let job = entry.clone();
            tauri::async_runtime::spawn_blocking(move || winget::run_install(&job, simulate))
                .await
                .unwrap_or_else(|e| InstallOutcome::failed(e.to_string()))
        } else if declined {
            InstallOutcome::failed(DECLINED_MESSAGE)
        } else {
            match worker.call(Request::InstallApp { app_id: entry.id.clone() }, |_| {}).await {
                Ok(value) => serde_json::from_value(value)
                    .unwrap_or_else(|e| InstallOutcome::failed(format!("Unexpected reply: {e}"))),
                Err(message) => {
                    declined = message == DECLINED_MESSAGE;
                    InstallOutcome::failed(message)
                }
            }
        };
        log::info!("{}: {:?} ({})", entry.id, outcome.state, outcome.message);
        summary.add(outcome.state);
        emit(&app, &entry.id, outcome.state, outcome.message);
    }

    let _ = app.emit("install-finished", &summary);
    summary
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_dedupes_and_flags_unknown_ids() {
        let ids = vec!["Valve.Steam".into(), "valve.steam".into(), "Evil.App".into()];
        let (apps, unknown) = resolve(&ids);
        assert_eq!(apps.len(), 1);
        assert_eq!(unknown, vec!["Evil.App".to_string()]);
    }

    #[test]
    fn summary_counts_states() {
        let mut s = InstallSummary::default();
        s.add(InstallState::Installed);
        s.add(InstallState::RebootRequired);
        s.add(InstallState::AlreadyInstalled);
        s.add(InstallState::Failed);
        assert_eq!((s.installed, s.already_installed, s.failed, s.reboot_required), (2, 1, 1, true));
    }
}

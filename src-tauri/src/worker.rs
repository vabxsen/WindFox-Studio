//! The elevated helper. It is the same executable started with `--worker`.
//! It only does three things: install apps that are in the embedded catalog,
//! create a restore point, and search/install drivers from Windows Update.

use crate::catalog::catalog;
use crate::drivers::{restore, wua};
use crate::ipc::{Reply, ReplyEnvelope, Request, RequestEnvelope};
use crate::winget;
use serde_json::json;
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::os::windows::io::AsRawHandle;
use windows::Win32::Foundation::HANDLE;
use windows::Win32::System::Com::{
    CoInitializeEx, CoInitializeSecurity, COINIT_MULTITHREADED, EOAC_DYNAMIC_CLOAKING,
    RPC_C_AUTHN_LEVEL_PKT_PRIVACY, RPC_C_IMP_LEVEL_IMPERSONATE,
};
use windows::Win32::System::Pipes::GetNamedPipeServerProcessId;

/// Entry point for `--worker <pipe> --parent <pid>`. Returns the exit code.
pub fn run(args: &[String]) -> i32 {
    let value_after = |flag: &str| {
        args.iter().position(|a| a == flag).and_then(|i| args.get(i + 1)).cloned()
    };
    let (Some(pipe), Some(parent)) = (value_after("--worker"), value_after("--parent")) else {
        return 2;
    };
    let Ok(parent) = parent.parse::<u32>() else { return 2 };
    if !pipe.starts_with(r"\\.\pipe\windfox-") {
        return 2;
    }

    init_com();

    let Ok(file) = OpenOptions::new().read(true).write(true).open(&pipe) else { return 3 };

    // Only talk to the process that started us.
    let mut server_pid = 0u32;
    let handle = HANDLE(file.as_raw_handle() as _);
    if unsafe { GetNamedPipeServerProcessId(handle, &mut server_pid) }.is_err() || server_pid != parent {
        return 4;
    }

    let Ok(read_half) = file.try_clone() else { return 3 };
    let mut writer = file;
    for line in BufReader::new(read_half).lines() {
        let Ok(line) = line else { break };
        let Ok(envelope) = serde_json::from_str::<RequestEnvelope>(&line) else { continue };
        handle_request(envelope, &mut writer);
    }
    0
}

fn init_com() {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        // Recommended before System Restore and WUA calls from a client process.
        let _ = CoInitializeSecurity(
            None,
            -1,
            None,
            None,
            RPC_C_AUTHN_LEVEL_PKT_PRIVACY,
            RPC_C_IMP_LEVEL_IMPERSONATE,
            None,
            EOAC_DYNAMIC_CLOAKING,
            None,
        );
    }
}

fn send(writer: &mut File, id: u64, reply: Reply) {
    if let Ok(mut line) = serde_json::to_string(&ReplyEnvelope { id, reply }) {
        line.push('\n');
        let _ = writer.write_all(line.as_bytes());
        let _ = writer.flush();
    }
}

fn handle_request(envelope: RequestEnvelope, writer: &mut File) {
    let id = envelope.id;
    let reply = match envelope.request {
        Request::InstallApp { app_id } => match catalog().find(&app_id) {
            Some(app) => {
                let outcome = winget::run_install(app, false);
                Reply::Done { payload: json!(outcome) }
            }
            None => Reply::Error { message: format!("'{app_id}' isn't in the app catalog") },
        },
        Request::CreateRestorePoint => match restore::create("WindFox Studio: before driver install") {
            Ok(()) => Reply::Done { payload: json!({ "created": true }) },
            Err(message) => Reply::Error { message },
        },
        Request::ScanDrivers => match wua::search() {
            Ok(updates) => Reply::Done { payload: json!(updates) },
            Err(message) => Reply::Error { message },
        },
        Request::InstallDrivers { update_ids } => {
            let mut progress = |p: wua::DriverProgress| {
                send(writer, id, Reply::Progress { payload: json!(p) });
            };
            match wua::install(&update_ids, &mut progress) {
                Ok(summary) => Reply::Done { payload: json!(summary) },
                Err(message) => Reply::Error { message },
            }
        }
    };
    send(writer, id, reply);
}

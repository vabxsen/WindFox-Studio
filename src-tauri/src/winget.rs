//! Thin wrapper around the `winget` command line.

use crate::catalog::CatalogApp;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::os::windows::process::CommandExt;
use std::process::Command;
use std::time::Duration;

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum InstallState {
    Queued,
    Installing,
    Installed,
    AlreadyInstalled,
    RebootRequired,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallOutcome {
    pub state: InstallState,
    pub message: String,
}

impl InstallOutcome {
    pub fn failed(message: impl Into<String>) -> Self {
        Self { state: InstallState::Failed, message: message.into() }
    }
}

/// Arguments for a silent, non-interactive install of one catalog app.
pub fn install_args(app: &CatalogApp) -> Vec<String> {
    [
        "install",
        "--id",
        &app.id,
        "--exact",
        "--source",
        app.source.as_str(),
        "--silent",
        "--accept-package-agreements",
        "--accept-source-agreements",
        "--disable-interactivity",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect()
}

/// Maps a winget exit code to a state and a short, friendly message.
/// Codes come from winget's `returnCodes.md`.
pub fn describe_exit_code(code: i32) -> (InstallState, &'static str) {
    use InstallState::*;
    match code as u32 {
        0 => (Installed, "Installed"),
        0x8A15_0061 | 0x8A15_010D => (AlreadyInstalled, "Already installed"),
        0x8A15_010E => (AlreadyInstalled, "A newer version is already installed"),
        0x8A15_0109 | 0x8A15_010B => (RebootRequired, "Installed. Restart your PC to finish."),
        0x8A15_010A => (Failed, "Restart your PC, then try again"),
        0x8A15_0014 | 0x8A15_0017 => (Failed, "Package not found"),
        0x8A15_0016 => (Failed, "More than one package matched"),
        0x8A15_0010 => (Failed, "No installer is available for this PC"),
        0x8A15_0011 => (Failed, "The installer didn't match its expected hash, so it was blocked"),
        0x8A15_0008 | 0x8A15_0086 => (Failed, "Download failed"),
        0x8A15_003A | 0x8A15_010F | 0x8A15_001B | 0x8A15_001C => (Failed, "Blocked by a policy on this PC"),
        0x8A15_010C | 0x8A15_0005 => (Failed, "Cancelled"),
        0x8A15_0101 | 0x8A15_0103 | 0x8A15_0111 => (Failed, "The app is running. Close it and retry."),
        0x8A15_0102 => (Failed, "Another installation is running. Retry in a moment."),
        0x8A15_0105 => (Failed, "Not enough disk space"),
        0x8A15_0107 => (Failed, "No internet connection"),
        0x8A15_0104 | 0x8A15_0110 | 0x8A15_004C => (Failed, "A required dependency couldn't be installed"),
        0x8A15_001E | 0x8A15_007F..=0x8A15_0085 => (Failed, "Microsoft Store install failed"),
        0x8A15_0041 | 0x8A15_0046 => (Failed, "The package agreements weren't accepted"),
        _ => (Failed, "The installer failed"),
    }
}

/// Turns a finished winget run into an outcome.
pub fn outcome_from(code: i32, stdout: &str) -> InstallOutcome {
    let (mut state, message) = describe_exit_code(code);
    let mut message = message.to_string();
    if state == InstallState::Failed {
        let lower = stdout.to_ascii_lowercase();
        if lower.contains("already installed") || lower.contains("no newer package versions") {
            state = InstallState::AlreadyInstalled;
            message = "Already installed".into();
        } else {
            message = format!("{message} (0x{:08X})", code as u32);
        }
    }
    InstallOutcome { state, message }
}

/// Installs one app. In simulate mode nothing runs; the command is only logged.
pub fn run_install(app: &CatalogApp, simulate: bool) -> InstallOutcome {
    let args = install_args(app);
    if simulate {
        log::info!("[simulate] winget {}", args.join(" "));
        std::thread::sleep(Duration::from_millis(900));
        return InstallOutcome {
            state: InstallState::Installed,
            message: "Simulated: nothing was installed".into(),
        };
    }

    log::info!("winget {}", args.join(" "));
    match Command::new("winget").args(&args).creation_flags(CREATE_NO_WINDOW).output() {
        Ok(output) => {
            let code = output.status.code().unwrap_or(-1);
            let stdout = String::from_utf8_lossy(&output.stdout);
            let outcome = outcome_from(code, &stdout);
            if outcome.state == InstallState::Failed {
                let tail: String = stdout.lines().rev().take(6).collect::<Vec<_>>().join(" | ");
                log::warn!("{} failed with 0x{:08X}: {}", app.id, code as u32, tail);
            }
            outcome
        }
        Err(err) => InstallOutcome::failed(format!("Couldn't start winget: {err}")),
    }
}

/// IDs (lower-case) of packages winget can see as installed.
pub fn installed_ids() -> anyhow::Result<HashSet<String>> {
    let path = std::env::temp_dir().join(format!("windfox-export-{}.json", std::process::id()));
    let output = Command::new("winget")
        .arg("export")
        .arg("-o")
        .arg(&path)
        .args(["--accept-source-agreements", "--disable-interactivity"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()?;
    // winget exits non-zero when some installed apps aren't in any source,
    // but it still writes the file, so only the file matters.
    let text = std::fs::read_to_string(&path).map_err(|e| {
        anyhow::anyhow!("winget export failed (exit {:?}): {e}", output.status.code())
    })?;
    let _ = std::fs::remove_file(&path);
    parse_export(&text)
}

pub fn parse_export(text: &str) -> anyhow::Result<HashSet<String>> {
    let value: serde_json::Value = serde_json::from_str(text.trim_start_matches('\u{feff}'))?;
    let mut ids = HashSet::new();
    for source in value["Sources"].as_array().into_iter().flatten() {
        for package in source["Packages"].as_array().into_iter().flatten() {
            if let Some(id) = package["PackageIdentifier"].as_str() {
                ids.insert(id.to_ascii_lowercase());
            }
        }
    }
    Ok(ids)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog::catalog;

    #[test]
    fn builds_silent_exact_args() {
        let app = catalog().find("7zip.7zip").unwrap();
        let args = install_args(app);
        assert_eq!(&args[..6], ["install", "--id", "7zip.7zip", "--exact", "--source", "winget"]);
        assert!(args.contains(&"--silent".to_string()));
        assert!(args.contains(&"--disable-interactivity".to_string()));
    }

    #[test]
    fn store_apps_use_msstore_source() {
        let app = catalog().find("9WZDNCRFJ3TJ").unwrap();
        assert!(install_args(app).windows(2).any(|w| w == ["--source", "msstore"]));
    }

    #[test]
    fn maps_exit_codes() {
        assert_eq!(describe_exit_code(0).0, InstallState::Installed);
        assert_eq!(describe_exit_code(0x8A15_0061_u32 as i32).0, InstallState::AlreadyInstalled);
        assert_eq!(describe_exit_code(0x8A15_0109_u32 as i32).0, InstallState::RebootRequired);
        assert_eq!(describe_exit_code(0x8A15_0107_u32 as i32).1, "No internet connection");
        assert_eq!(describe_exit_code(1).0, InstallState::Failed);
    }

    #[test]
    fn failure_message_includes_hex_code() {
        let outcome = outcome_from(0x8A15_0105_u32 as i32, "");
        assert_eq!(outcome.message, "Not enough disk space (0x8A150105)");
    }

    #[test]
    fn detects_already_installed_from_output() {
        let outcome = outcome_from(-1, "Found an existing package already installed.");
        assert_eq!(outcome.state, InstallState::AlreadyInstalled);
    }

    #[test]
    fn parses_export_file() {
        let json = r#"{"Sources":[{"Packages":[{"PackageIdentifier":"Valve.Steam"},{"PackageIdentifier":"7zip.7zip"}],"SourceDetails":{"Name":"winget"}},{"Packages":[{"PackageIdentifier":"9WZDNCRFJ3TJ"}]}]}"#;
        let ids = parse_export(json).unwrap();
        assert!(ids.contains("valve.steam"));
        assert!(ids.contains("9wzdncrfj3tj"));
        assert_eq!(ids.len(), 3);
    }
}

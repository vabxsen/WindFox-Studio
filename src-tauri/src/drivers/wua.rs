//! Driver updates from Windows Update through the Windows Update Agent API.
//! These are the same Microsoft-signed drivers shown in
//! Settings > Windows Update > Advanced options > Optional updates.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use windows::core::{Interface, BSTR};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED,
};
use windows::Win32::System::UpdateAgent::{
    orcSucceeded, orcSucceededWithErrors, ssWindowsUpdate, IUpdate, IUpdate3, IUpdateCollection,
    IUpdateSession, IWindowsDriverUpdate, OperationResultCode, UpdateCollection, UpdateSession,
};

const CRITERIA: &str = "IsInstalled=0 and Type='Driver' and IsHidden=0";
const CLIENT_ID: &str = "WindFox Studio";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DriverUpdate {
    pub update_id: String,
    pub title: String,
    pub description: String,
    pub driver_class: String,
    pub provider: String,
    pub manufacturer: String,
    pub hardware_id: String,
    pub date: Option<String>,
    /// Offered as optional (not installed automatically by Windows Update).
    pub optional: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DriverProgress {
    pub update_id: String,
    /// "downloading" | "installing" | "installed" | "failed"
    pub state: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DriverInstallSummary {
    pub results: Vec<DriverProgress>,
    pub reboot_required: bool,
}

/// Initializes COM (MTA) for the current thread and undoes it on drop.
struct ComScope(bool);

impl ComScope {
    fn enter() -> Self {
        Self(unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }.is_ok())
    }
}

impl Drop for ComScope {
    fn drop(&mut self) {
        if self.0 {
            unsafe { CoUninitialize() };
        }
    }
}

fn session() -> windows::core::Result<IUpdateSession> {
    unsafe {
        let session: IUpdateSession = CoCreateInstance(&UpdateSession, None, CLSCTX_INPROC_SERVER)?;
        session.SetClientApplicationID(&BSTR::from(CLIENT_ID))?;
        Ok(session)
    }
}

fn search_collection(session: &IUpdateSession) -> windows::core::Result<IUpdateCollection> {
    unsafe {
        let searcher = session.CreateUpdateSearcher()?;
        searcher.SetClientApplicationID(&BSTR::from(CLIENT_ID))?;
        searcher.SetServerSelection(ssWindowsUpdate)?;
        searcher.Search(&BSTR::from(CRITERIA))?.Updates()
    }
}

fn friendly(err: windows::core::Error) -> String {
    match err.code().0 as u32 {
        0x8024_402C | 0x8024_4022 | 0x8024_401C => "Couldn't reach Windows Update. Check your internet connection.".into(),
        0x8024_0438 => "Windows Update is unreachable right now (it may be blocked by a firewall or policy).".into(),
        0x8007_0005 => "Windows Update needs administrator rights for this.".into(),
        code => format!("Windows Update error 0x{code:08X}: {}", err.message()),
    }
}

fn update_id(update: &IUpdate) -> windows::core::Result<String> {
    unsafe { Ok(update.Identity()?.UpdateID()?.to_string()) }
}

fn describe(update: &IUpdate) -> windows::core::Result<DriverUpdate> {
    unsafe {
        let driver = update.cast::<IWindowsDriverUpdate>().ok();
        let text = |f: &dyn Fn(&IWindowsDriverUpdate) -> windows::core::Result<BSTR>| {
            driver.as_ref().and_then(|d| f(d).ok()).map(|b| b.to_string()).unwrap_or_default()
        };
        Ok(DriverUpdate {
            update_id: update_id(update)?,
            title: update.Title()?.to_string(),
            description: update.Description().map(|b| b.to_string()).unwrap_or_default(),
            driver_class: text(&|d| d.DriverClass()),
            provider: text(&|d| d.DriverProvider()),
            manufacturer: text(&|d| d.DriverManufacturer()),
            hardware_id: text(&|d| d.DriverHardwareID()),
            date: driver.as_ref().and_then(|d| d.DriverVerDate().ok()).and_then(ole_date),
            optional: update
                .cast::<IUpdate3>()
                .and_then(|u| u.BrowseOnly())
                .map(|b| b.as_bool())
                .unwrap_or(false),
        })
    }
}

/// Driver updates Windows Update offers for this PC. Takes 30 s to 2 min.
pub fn search() -> Result<Vec<DriverUpdate>, String> {
    let _com = ComScope::enter();
    let session = session().map_err(friendly)?;
    let updates = search_collection(&session).map_err(friendly)?;
    let count = unsafe { updates.Count() }.map_err(friendly)?;
    let mut list = Vec::new();
    for i in 0..count {
        let update = unsafe { updates.get_Item(i) }.map_err(friendly)?;
        match describe(&update) {
            Ok(d) => list.push(d),
            Err(e) => log::warn!("skipping an update that couldn't be read: {e}"),
        }
    }
    list.sort_by(|a, b| a.driver_class.cmp(&b.driver_class).then(a.title.cmp(&b.title)));
    Ok(list)
}

fn succeeded(code: OperationResultCode) -> bool {
    code == orcSucceeded || code == orcSucceededWithErrors
}

/// Downloads and installs the chosen updates one by one. Needs admin rights.
pub fn install(
    update_ids: &[String],
    progress: &mut dyn FnMut(DriverProgress),
) -> Result<DriverInstallSummary, String> {
    let _com = ComScope::enter();
    let wanted: HashSet<String> = update_ids.iter().map(|s| s.to_ascii_lowercase()).collect();
    let session = session().map_err(friendly)?;
    let updates = search_collection(&session).map_err(friendly)?;
    let count = unsafe { updates.Count() }.map_err(friendly)?;

    let mut results = Vec::new();
    let mut found = HashSet::new();
    let mut reboot_required = false;

    for i in 0..count {
        let update = unsafe { updates.get_Item(i) }.map_err(friendly)?;
        let Ok(id) = update_id(&update) else { continue };
        if !wanted.contains(&id.to_ascii_lowercase()) {
            continue;
        }
        found.insert(id.to_ascii_lowercase());

        let mut report = |state: &str, message: String| {
            let p = DriverProgress { update_id: id.clone(), state: state.into(), message };
            progress(p.clone());
            p
        };

        report("downloading", "Downloading…".into());
        let outcome = install_one(&session, &update, &mut |msg| {
            report("installing", msg.into());
        });
        let result = match outcome {
            Ok(reboot) => {
                reboot_required |= reboot;
                report("installed", if reboot { "Installed. Restart to finish." } else { "Installed" }.into())
            }
            Err(message) => report("failed", message),
        };
        results.push(result);
    }

    for id in update_ids {
        if !found.contains(&id.to_ascii_lowercase()) {
            let p = DriverProgress {
                update_id: id.clone(),
                state: "failed".into(),
                message: "Windows Update no longer offers this driver.".into(),
            };
            progress(p.clone());
            results.push(p);
        }
    }

    Ok(DriverInstallSummary { results, reboot_required })
}

/// Returns whether a restart is required.
fn install_one(
    session: &IUpdateSession,
    update: &IUpdate,
    installing: &mut dyn FnMut(&str),
) -> Result<bool, String> {
    unsafe {
        if !update.EulaAccepted().map_err(friendly)?.as_bool() {
            update.AcceptEula().map_err(friendly)?;
        }
        let one: IUpdateCollection =
            CoCreateInstance(&UpdateCollection, None, CLSCTX_INPROC_SERVER).map_err(friendly)?;
        one.Add(update).map_err(friendly)?;

        if !update.IsDownloaded().map_err(friendly)?.as_bool() {
            let downloader = session.CreateUpdateDownloader().map_err(friendly)?;
            downloader.SetUpdates(&one).map_err(friendly)?;
            let result = downloader.Download().map_err(friendly)?;
            if !succeeded(result.ResultCode().map_err(friendly)?) {
                return Err(format!("Download failed (0x{:08X})", result.HResult().unwrap_or(0) as u32));
            }
        }

        installing("Installing…");
        let installer = session.CreateUpdateInstaller().map_err(friendly)?;
        installer.SetUpdates(&one).map_err(friendly)?;
        let result = installer.Install().map_err(friendly)?;
        if !succeeded(result.ResultCode().map_err(friendly)?) {
            return Err(format!("Install failed (0x{:08X})", result.HResult().unwrap_or(0) as u32));
        }
        Ok(result.RebootRequired().map(|b| b.as_bool()).unwrap_or(false))
    }
}

/// OLE Automation date (days since 1899-12-30) to `YYYY-MM-DD`.
pub fn ole_date(value: f64) -> Option<String> {
    if !value.is_finite() || value < 1.0 {
        return None;
    }
    // Days from 1970-01-01, then the civil-from-days algorithm (H. Hinnant).
    let z = value.floor() as i64 - 25_569 + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    Some(format!("{year:04}-{month:02}-{day:02}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_ole_dates() {
        assert_eq!(ole_date(45_292.0).as_deref(), Some("2024-01-01"));
        assert_eq!(ole_date(25_569.0).as_deref(), Some("1970-01-01"));
        assert_eq!(ole_date(45_351.5).as_deref(), Some("2024-02-29"));
        assert_eq!(ole_date(0.0), None);
    }
}

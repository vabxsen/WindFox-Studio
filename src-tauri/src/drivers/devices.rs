//! Devices that Device Manager would flag with a yellow warning.

use serde::{Deserialize, Serialize};
use wmi::WMIConnection;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblemDevice {
    pub name: String,
    pub device_id: String,
    pub class: Option<String>,
    pub error_code: u32,
    pub problem: String,
    pub hardware_ids: Vec<String>,
    /// A Windows Update driver that matches one of this device's hardware IDs.
    pub fix_update_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename = "Win32_PnPEntity")]
struct PnpEntity {
    #[serde(rename = "Name")]
    name: Option<String>,
    #[serde(rename = "DeviceID")]
    device_id: Option<String>,
    #[serde(rename = "ConfigManagerErrorCode")]
    error_code: Option<u32>,
    #[serde(rename = "HardwareID")]
    hardware_ids: Option<Vec<String>>,
    #[serde(rename = "PNPClass")]
    class: Option<String>,
}

/// Device Manager problem codes that point at a driver problem. Disabled (22)
/// and disconnected (45) devices are left out on purpose.
pub fn problem_text(code: u32) -> &'static str {
    match code {
        1 => "Not configured correctly",
        3 => "The driver may be corrupted",
        10 => "The device can't start",
        12 => "Not enough free resources",
        14 => "Restart your PC to finish setting it up",
        18 => "The drivers need to be reinstalled",
        19 => "Its registry settings are damaged",
        24 => "Not present or not working properly",
        28 => "No driver is installed",
        31 => "Windows couldn't load the driver",
        32 => "The driver service is disabled",
        37 => "The driver failed to initialize",
        39 => "The driver is missing or corrupted",
        40 => "The driver's registry entry is damaged",
        41 => "The driver loaded but the hardware wasn't found",
        43 => "Windows stopped it because it reported problems",
        48 => "The driver was blocked because of known issues",
        52 => "The driver's signature couldn't be verified",
        _ => "",
    }
}

pub fn problem_devices() -> Result<Vec<ProblemDevice>, String> {
    let wmi = WMIConnection::new().map_err(|e| format!("Couldn't read devices: {e}"))?;
    let rows: Vec<PnpEntity> = wmi
        .raw_query(
            "SELECT Name, DeviceID, ConfigManagerErrorCode, HardwareID, PNPClass \
             FROM Win32_PnPEntity WHERE ConfigManagerErrorCode <> 0",
        )
        .map_err(|e| format!("Couldn't read devices: {e}"))?;

    Ok(rows
        .into_iter()
        .filter_map(|row| {
            let code = row.error_code?;
            let problem = problem_text(code);
            if problem.is_empty() {
                return None;
            }
            Some(ProblemDevice {
                name: row.name.unwrap_or_else(|| "Unknown device".into()),
                device_id: row.device_id.unwrap_or_default(),
                class: row.class,
                error_code: code,
                problem: problem.into(),
                hardware_ids: row.hardware_ids.unwrap_or_default(),
                fix_update_id: None,
            })
        })
        .collect())
}

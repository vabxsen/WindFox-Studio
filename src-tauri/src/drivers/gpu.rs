//! Graphics cards and the vendor app that keeps their drivers current.

use serde::{Deserialize, Serialize};
use wmi::WMIConnection;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VendorTool {
    pub name: String,
    /// Installed through the catalog when set; otherwise `url` is opened.
    pub winget_id: Option<String>,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Gpu {
    pub name: String,
    pub vendor: String,
    pub driver_version: Option<String>,
    pub driver_date: Option<String>,
    /// Running on Microsoft's fallback driver, so a real driver is missing.
    pub basic_driver: bool,
    pub tool: Option<VendorTool>,
}

#[derive(Deserialize)]
#[serde(rename = "Win32_VideoController")]
struct VideoController {
    #[serde(rename = "Name")]
    name: Option<String>,
    #[serde(rename = "PNPDeviceID")]
    pnp_device_id: Option<String>,
    #[serde(rename = "DriverVersion")]
    driver_version: Option<String>,
    #[serde(rename = "DriverDate")]
    driver_date: Option<String>,
}

pub fn vendor_from_pnp_id(pnp_id: &str) -> &'static str {
    let id = pnp_id.to_ascii_uppercase();
    if id.contains("VEN_10DE") {
        "nvidia"
    } else if id.contains("VEN_1002") || id.contains("VEN_1022") {
        "amd"
    } else if id.contains("VEN_8086") {
        "intel"
    } else if id.contains("VEN_1414") {
        "microsoft"
    } else {
        "other"
    }
}

pub fn vendor_tool(vendor: &str) -> Option<VendorTool> {
    match vendor {
        "nvidia" => Some(VendorTool {
            name: "NVIDIA App".into(),
            winget_id: None,
            url: "https://www.nvidia.com/en-us/software/nvidia-app/".into(),
        }),
        "amd" => Some(VendorTool {
            name: "AMD Software: Adrenalin Edition".into(),
            winget_id: None,
            url: "https://www.amd.com/en/support/download/drivers.html".into(),
        }),
        "intel" => Some(VendorTool {
            name: "Intel Driver & Support Assistant".into(),
            winget_id: Some("Intel.IntelDriverAndSupportAssistant".into()),
            url: "https://www.intel.com/content/www/us/en/support/detect.html".into(),
        }),
        _ => None,
    }
}

/// WMI dates look like `20240115000000.000000-000`.
pub fn wmi_date(raw: &str) -> Option<String> {
    let digits = raw.get(0..8)?;
    if !digits.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    Some(format!("{}-{}-{}", &digits[0..4], &digits[4..6], &digits[6..8]))
}

pub fn gpus() -> Result<Vec<Gpu>, String> {
    let wmi = WMIConnection::new().map_err(|e| format!("Couldn't read graphics cards: {e}"))?;
    let rows: Vec<VideoController> = wmi
        .raw_query("SELECT Name, PNPDeviceID, DriverVersion, DriverDate FROM Win32_VideoController")
        .map_err(|e| format!("Couldn't read graphics cards: {e}"))?;

    Ok(rows
        .into_iter()
        .filter(|row| row.pnp_device_id.as_deref().is_some_and(|id| id.starts_with("PCI")))
        .map(|row| {
            let name = row.name.unwrap_or_else(|| "Graphics card".into());
            let vendor = vendor_from_pnp_id(row.pnp_device_id.as_deref().unwrap_or_default());
            Gpu {
                basic_driver: vendor == "microsoft" || name.contains("Basic Display"),
                tool: vendor_tool(vendor),
                vendor: vendor.into(),
                driver_version: row.driver_version,
                driver_date: row.driver_date.as_deref().and_then(wmi_date),
                name,
            }
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_vendors() {
        assert_eq!(vendor_from_pnp_id(r"PCI\VEN_10DE&DEV_2684&SUBSYS"), "nvidia");
        assert_eq!(vendor_from_pnp_id(r"pci\ven_1002&dev_744c"), "amd");
        assert_eq!(vendor_from_pnp_id(r"PCI\VEN_8086&DEV_A7A0"), "intel");
        assert_eq!(vendor_from_pnp_id(r"ROOT\BasicDisplay"), "other");
    }

    #[test]
    fn intel_tool_installs_from_catalog() {
        let tool = vendor_tool("intel").unwrap();
        let id = tool.winget_id.unwrap();
        assert!(crate::catalog::catalog().find(&id).is_some());
    }

    #[test]
    fn parses_wmi_dates() {
        assert_eq!(wmi_date("20240115000000.000000-000").as_deref(), Some("2024-01-15"));
        assert_eq!(wmi_date("garbage"), None);
    }
}

//! Driver scanning: problem devices (WMI), graphics cards (WMI) and driver
//! updates offered by Windows Update (WUA COM API).

pub mod devices;
pub mod gpu;
pub mod restore;
pub mod wua;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DriverScan {
    pub gpus: Vec<gpu::Gpu>,
    pub problem_devices: Vec<devices::ProblemDevice>,
    pub updates: Vec<wua::DriverUpdate>,
    /// Set when the Windows Update search failed; the other lists still show.
    pub update_error: Option<String>,
}

/// Marks each problem device that a Windows Update driver can fix.
pub fn link_fixes(devices: &mut [devices::ProblemDevice], updates: &[wua::DriverUpdate]) {
    for device in devices.iter_mut() {
        let ids: Vec<String> = device.hardware_ids.iter().map(|h| h.to_ascii_lowercase()).collect();
        device.fix_update_id = updates
            .iter()
            .find(|u| !u.hardware_id.is_empty() && ids.contains(&u.hardware_id.to_ascii_lowercase()))
            .map(|u| u.update_id.clone());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn links_device_to_matching_update() {
        let mut devices = vec![devices::ProblemDevice {
            name: "Unknown device".into(),
            device_id: "PCI\\VEN_8086&DEV_1234\\3&1".into(),
            class: None,
            error_code: 28,
            problem: devices::problem_text(28).into(),
            hardware_ids: vec!["PCI\\VEN_8086&DEV_1234&REV_01".into(), "PCI\\VEN_8086&DEV_1234".into()],
            fix_update_id: None,
        }];
        let updates = vec![wua::DriverUpdate {
            update_id: "abc".into(),
            title: "Intel - System - 1.0".into(),
            description: String::new(),
            driver_class: "System".into(),
            provider: "Intel".into(),
            manufacturer: "Intel".into(),
            hardware_id: "pci\\ven_8086&dev_1234".into(),
            date: None,
            optional: true,
        }];
        link_fixes(&mut devices, &updates);
        assert_eq!(devices[0].fix_update_id.as_deref(), Some("abc"));
    }
}

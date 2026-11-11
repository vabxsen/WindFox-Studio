//! System Restore point before installing drivers. Needs admin rights.

use windows::Win32::Foundation::{ERROR_SERVICE_DISABLED, ERROR_TIMEOUT};
use windows::Win32::System::Restore::{
    SRSetRestorePointW, BEGIN_SYSTEM_CHANGE, DEVICE_DRIVER_INSTALL, END_SYSTEM_CHANGE,
    RESTOREPOINTINFOW, STATEMGRSTATUS,
};

pub fn create(description: &str) -> Result<(), String> {
    // The struct is packed, so build the description before moving it in.
    let mut text = [0u16; 256];
    for (slot, unit) in text.iter_mut().zip(description.encode_utf16().take(255)) {
        *slot = unit;
    }
    let mut info = RESTOREPOINTINFOW {
        dwEventType: BEGIN_SYSTEM_CHANGE,
        dwRestorePtType: DEVICE_DRIVER_INSTALL,
        llSequenceNumber: 0,
        szDescription: text,
    };

    let mut status = STATEMGRSTATUS::default();
    let ok = unsafe { SRSetRestorePointW(&info, &mut status) };
    if !ok.as_bool() {
        return Err(match status.nStatus {
            ERROR_SERVICE_DISABLED => "System Protection is turned off for your system drive, so Windows can't make a restore point.".into(),
            ERROR_TIMEOUT => "Windows timed out while making a restore point.".into(),
            other => format!("Windows couldn't make a restore point (error {}).", other.0),
        });
    }

    // Close the change so the restore point is finalized.
    info.dwEventType = END_SYSTEM_CHANGE;
    info.llSequenceNumber = status.llSequenceNumber;
    let _ = unsafe { SRSetRestorePointW(&info, &mut status) };
    Ok(())
}

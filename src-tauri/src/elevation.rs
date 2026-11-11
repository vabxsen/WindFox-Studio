//! Starting the elevated helper process.

use std::os::windows::process::CommandExt;
use std::path::Path;
use windows::core::{HSTRING, PCWSTR};
use windows::Win32::Foundation::{CloseHandle, ERROR_CANCELLED, HANDLE, HWND};
use windows::Win32::Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};
use windows::Win32::System::Com::{
    CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED, COINIT_DISABLE_OLE1DDE,
};
use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
use windows::Win32::UI::Shell::{ShellExecuteExW, SEE_MASK_NOASYNC, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW};
use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub const DECLINED_MESSAGE: &str = "You declined the Windows permission prompt.";

/// True when this process already runs with an elevated (admin) token.
pub fn is_elevated() -> bool {
    unsafe {
        let mut token = HANDLE::default();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).is_err() {
            return false;
        }
        let mut elevation = TOKEN_ELEVATION::default();
        let mut returned = 0u32;
        let ok = GetTokenInformation(
            token,
            TokenElevation,
            Some(&mut elevation as *mut _ as *mut _),
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut returned,
        );
        let _ = CloseHandle(token);
        ok.is_ok() && elevation.TokenIsElevated != 0
    }
}

/// Starts `exe --worker <pipe> --parent <pid>` elevated. This shows one UAC
/// prompt and blocks until the user answers it, so call it off the UI thread.
/// `owner` is the main window handle, so the prompt appears in front of it.
pub fn launch_worker(exe: &Path, pipe: &str, owner: isize) -> Result<(), String> {
    let parent = std::process::id().to_string();

    if is_elevated() {
        return std::process::Command::new(exe)
            .args(["--worker", pipe, "--parent", &parent])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Couldn't start the helper: {e}"));
    }

    // ShellExecuteEx needs COM (single-threaded apartment) on the calling
    // thread; this runs on a background pool thread that has none.
    let com = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE) };

    let file = HSTRING::from(exe.as_os_str());
    let params = HSTRING::from(format!("--worker \"{pipe}\" --parent {parent}"));
    let verb = HSTRING::from("runas");
    let mut info = SHELLEXECUTEINFOW {
        cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
        fMask: SEE_MASK_NOCLOSEPROCESS | SEE_MASK_NOASYNC,
        hwnd: HWND(owner as *mut _),
        lpVerb: PCWSTR(verb.as_ptr()),
        lpFile: PCWSTR(file.as_ptr()),
        lpParameters: PCWSTR(params.as_ptr()),
        nShow: SW_HIDE.0,
        ..Default::default()
    };

    let result = unsafe { ShellExecuteExW(&mut info) };
    if com.is_ok() {
        unsafe { CoUninitialize() };
    }

    match result {
        Ok(()) => {
            log::info!("elevated helper started");
            if !info.hProcess.is_invalid() {
                unsafe {
                    let _ = CloseHandle(info.hProcess);
                }
            }
            Ok(())
        }
        Err(err) => {
            log::warn!(
                "elevation request failed: 0x{:08X} {} (hInstApp {:?})",
                err.code().0 as u32,
                err.message(),
                info.hInstApp
            );
            if err.code() == ERROR_CANCELLED.to_hresult() {
                Err(DECLINED_MESSAGE.into())
            } else {
                Err(format!("Couldn't start the helper: {}", err.message()))
            }
        }
    }
}

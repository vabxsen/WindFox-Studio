//! Snap Layouts for the custom title bar. Windows shows the layout flyout for
//! the native maximize button; with our own caption buttons we open it with
//! Win+Z, the same shortcut Windows offers.

use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP,
    VIRTUAL_KEY, VK_LWIN,
};

const VK_Z: VIRTUAL_KEY = VIRTUAL_KEY(0x5A);

fn key(vk: VIRTUAL_KEY, up: bool) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk,
                wScan: 0,
                dwFlags: if up { KEYEVENTF_KEYUP } else { KEYBD_EVENT_FLAGS(0) },
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

pub fn show_snap_layouts() {
    let inputs = [key(VK_LWIN, false), key(VK_Z, false), key(VK_Z, true), key(VK_LWIN, true)];
    unsafe {
        SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
    }
}

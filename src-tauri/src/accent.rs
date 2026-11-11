//! The user's Windows accent color, so the app matches their PC like
//! built-in Windows apps do.

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use windows::Foundation::TypedEventHandler;
use windows::UI::ViewManagement::{UIColorType, UISettings};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Accent {
    pub accent: String,
    pub dark1: String,
    pub dark2: String,
    pub dark3: String,
    pub light1: String,
    pub light2: String,
    pub light3: String,
}

fn read(settings: &UISettings) -> windows::core::Result<Accent> {
    let hex = |kind: UIColorType| -> windows::core::Result<String> {
        let c = settings.GetColorValue(kind)?;
        Ok(format!("#{:02X}{:02X}{:02X}", c.R, c.G, c.B))
    };
    Ok(Accent {
        accent: hex(UIColorType::Accent)?,
        dark1: hex(UIColorType::AccentDark1)?,
        dark2: hex(UIColorType::AccentDark2)?,
        dark3: hex(UIColorType::AccentDark3)?,
        light1: hex(UIColorType::AccentLight1)?,
        light2: hex(UIColorType::AccentLight2)?,
        light3: hex(UIColorType::AccentLight3)?,
    })
}

pub fn current() -> windows::core::Result<Accent> {
    read(&UISettings::new()?)
}

/// Keeps the subscription alive for the life of the app.
struct AccentWatcher(#[allow(dead_code)] UISettings);

/// Emits `accent-changed` when the user changes their accent color.
pub fn watch(app: AppHandle) {
    let Ok(settings) = UISettings::new() else { return };
    let handle = app.clone();
    let handler = TypedEventHandler::new(move |_, _| {
        if let Ok(accent) = current() {
            let _ = handle.emit("accent-changed", accent);
        }
        Ok(())
    });
    if settings.ColorValuesChanged(&handler).is_ok() {
        app.manage(AccentWatcher(settings));
    }
}

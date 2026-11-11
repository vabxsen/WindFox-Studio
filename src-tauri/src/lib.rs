mod accent;
pub mod catalog;
pub mod drivers;
mod elevation;
pub mod installer;
pub mod ipc;
mod snap;
pub mod winget;
pub mod worker;

use drivers::{wua, DriverScan};
use ipc::{Request, WorkerClient};
use std::os::windows::process::CommandExt;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;

struct AppState {
    worker: Arc<WorkerClient>,
    installing: Arc<AtomicBool>,
}

#[tauri::command]
fn get_accent() -> Result<accent::Accent, String> {
    accent::current().map_err(|e| e.to_string())
}

/// Lower-case IDs of installed packages that winget knows about.
#[tauri::command]
async fn get_installed() -> Result<Vec<String>, String> {
    let ids = tauri::async_runtime::spawn_blocking(winget::installed_ids)
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    Ok(ids.into_iter().collect())
}

/// Starts installing in the background; progress arrives as events.
#[tauri::command]
fn start_install(app: AppHandle, state: State<'_, AppState>, ids: Vec<String>, simulate: bool) -> Result<(), String> {
    log::info!("start_install: {} app(s), simulate={simulate}: {}", ids.len(), ids.join(", "));
    if state.installing.swap(true, Ordering::SeqCst) {
        log::warn!("start_install refused: another install is already running");
        return Err("Another install is already running.".into());
    }
    let worker = state.worker.clone();
    let installing = state.installing.clone();
    tauri::async_runtime::spawn(async move {
        installer::run_batch(app, worker, ids, simulate).await;
        installing.store(false, Ordering::SeqCst);
    });
    Ok(())
}

#[tauri::command]
async fn scan_drivers(state: State<'_, AppState>) -> Result<DriverScan, String> {
    let (gpus, mut devices, search) = tauri::async_runtime::spawn_blocking(|| {
        let gpus = drivers::gpu::gpus().unwrap_or_else(|e| {
            log::warn!("{e}");
            Vec::new()
        });
        let devices = drivers::devices::problem_devices().unwrap_or_else(|e| {
            log::warn!("{e}");
            Vec::new()
        });
        (gpus, devices, wua::search())
    })
    .await
    .map_err(|e| e.to_string())?;

    let (updates, update_error) = match search {
        Ok(updates) => (updates, None),
        // Some PCs only allow the search with admin rights; retry in the helper.
        Err(message) if message.contains("administrator") => {
            match state.worker.call(Request::ScanDrivers, |_| {}).await {
                Ok(value) => (serde_json::from_value(value).unwrap_or_default(), None),
                Err(e) => (Vec::new(), Some(e)),
            }
        }
        Err(message) => (Vec::new(), Some(message)),
    };

    drivers::link_fixes(&mut devices, &updates);
    log::info!(
        "driver scan: {} gpus, {} problem devices, {} updates",
        gpus.len(),
        devices.len(),
        updates.len()
    );
    Ok(DriverScan { gpus, problem_devices: devices, updates, update_error })
}

#[tauri::command]
async fn create_restore_point(state: State<'_, AppState>) -> Result<(), String> {
    state.worker.call(Request::CreateRestorePoint, |_| {}).await.map(|_| ())
}

#[tauri::command]
async fn install_drivers(
    app: AppHandle,
    state: State<'_, AppState>,
    update_ids: Vec<String>,
) -> Result<wua::DriverInstallSummary, String> {
    let value = state
        .worker
        .call(Request::InstallDrivers { update_ids }, |p| {
            let _ = app.emit("driver-progress", p);
        })
        .await?;
    serde_json::from_value(value).map_err(|e| e.to_string())
}

#[tauri::command]
fn show_snap_layouts(window: tauri::WebviewWindow) {
    let _ = window.set_focus();
    snap::show_snap_layouts();
}

#[tauri::command]
fn restart_pc() -> Result<(), String> {
    std::process::Command::new("shutdown")
        .args(["/r", "/t", "10", "/c", "WindFox Studio is restarting your PC to finish installing drivers."])
        .creation_flags(0x0800_0000)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn open_logs(app: AppHandle) -> Result<(), String> {
    let dir = app.path().app_log_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    app.opener()
        .open_path(dir.to_string_lossy(), None::<&str>)
        .map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().level(log::LevelFilter::Info).build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            worker: Arc::new(WorkerClient::default()),
            installing: Arc::new(AtomicBool::new(false)),
        })
        .setup(|app| {
            log::info!(
                "WindFox Studio {} starting from {:?} (elevated: {})",
                app.package_info().version,
                std::env::current_exe().unwrap_or_default(),
                elevation::is_elevated()
            );
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(hwnd) = window.hwnd() {
                    app.state::<AppState>().worker.set_owner_window(hwnd.0 as isize);
                }
            }
            accent::watch(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_accent,
            get_installed,
            start_install,
            scan_drivers,
            create_restore_point,
            install_drivers,
            show_snap_layouts,
            restart_pc,
            open_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running WindFox Studio");
}

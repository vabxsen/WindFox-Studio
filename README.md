# WindFox Studio

A small Windows 11 app that sets up a PC in one go:

- **Apps:** pick what you use your PC for (Gaming, Entertainment, AI, Work, Utilities…), get suggestions, tick the apps you want, and install them all with one Windows permission prompt. Apps come from their official packages through **winget** or the **Microsoft Store**.
- **Drivers:** finds devices with missing drivers and the driver updates **Windows Update** offers for this PC. It makes a **restore point** before installing anything, and offers NVIDIA, AMD or Intel's own app for the newest graphics drivers.
- **Looks like Windows 11:** Mica background, the WinUI Gallery layout, Segoe UI Variable and Fluent icons, your Windows accent color, and light/dark mode.

Built with **Tauri 2** (Rust backend, WebView2 UI) and **React + Fluent UI React v9**.

## Develop

Requirements: Rust (MSVC toolchain), Visual Studio 2022 Build Tools (C++), Node.js LTS.

```powershell
npm install
npm run tauri dev       # run the app
npm run dev             # UI only, in a browser, with mock data
npm run check-catalog   # check every catalog ID resolves in winget
cd src-tauri; cargo test
cargo run --example scan   # read-only backend check on this PC
```

Build installers (NSIS `.exe` and `.msi` in `src-tauri/target/release/bundle/`):

```powershell
npm run tauri build
```

## How it works

| Part | Where |
| --- | --- |
| App catalog (categories, winget IDs) | `src-tauri/catalog.json` |
| winget wrapper and exit codes | `src-tauri/src/winget.rs` |
| Install queue and progress events | `src-tauri/src/installer.rs` |
| Elevated helper (one UAC prompt) | `src-tauri/src/worker.rs`, `ipc.rs`, `elevation.rs` |
| Problem devices / GPUs (WMI) | `src-tauri/src/drivers/devices.rs`, `gpu.rs` |
| Windows Update drivers (WUA COM) | `src-tauri/src/drivers/wua.rs` |
| Restore point | `src-tauri/src/drivers/restore.rs` |
| WinUI tokens and layout | `src/styles/winui-tokens.css`, `src/styles/app.css` |
| Shell (title bar, nav pane) | `src/shell/` |
| Pages | `src/pages/` |

The UI runs as a normal user. The first time something needs admin rights, it starts a copy of itself elevated (`--worker`). The two talk over a named pipe that only this user can open; the helper checks it was started by the app and only installs IDs that are in the embedded catalog.

**Simulate installs** (Settings) runs the whole flow without installing anything and logs the winget commands.

## Adding an app

Add an entry to `src-tauri/catalog.json`, then run `npm run check-catalog`. Set `"elevated": false` for installers that refuse to run as administrator (they then run in the normal UI process).

## License

WindFox Studio is free software under the [GNU General Public License v3.0](LICENSE). You can use, study, change and share it. If you distribute a modified version, it must also be released under the GPL with its source code.

The name "WindFox Studio" and its logo are not covered by the license. Forks are welcome, but please give them a different name and icon so people don't confuse them with this project.

Design credits and third-party licenses are listed in [NOTICE](NOTICE). WindFox Studio is an independent project and is not affiliated with or endorsed by Microsoft.

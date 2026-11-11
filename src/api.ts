/**
 * Typed bridge to the Rust backend. Outside Tauri (plain browser, used for
 * design work) every call is answered by mock data so all pages render.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { error as writeErrorLog, info as writeInfoLog } from "@tauri-apps/plugin-log";
import { openUrl } from "@tauri-apps/plugin-opener";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type InstallState =
  | "queued"
  | "installing"
  | "installed"
  | "alreadyInstalled"
  | "rebootRequired"
  | "failed";

export interface InstallProgress {
  id: string;
  state: InstallState;
  message: string;
}

export interface InstallSummary {
  installed: number;
  alreadyInstalled: number;
  failed: number;
  rebootRequired: boolean;
  simulated: boolean;
}

export interface Accent {
  accent: string;
  dark1: string;
  dark2: string;
  dark3: string;
  light1: string;
  light2: string;
  light3: string;
}

export interface VendorTool {
  name: string;
  wingetId: string | null;
  url: string;
}

export interface Gpu {
  name: string;
  vendor: string;
  driverVersion: string | null;
  driverDate: string | null;
  basicDriver: boolean;
  tool: VendorTool | null;
}

export interface ProblemDevice {
  name: string;
  deviceId: string;
  class: string | null;
  errorCode: number;
  problem: string;
  hardwareIds: string[];
  fixUpdateId: string | null;
}

export interface DriverUpdate {
  updateId: string;
  title: string;
  description: string;
  driverClass: string;
  provider: string;
  manufacturer: string;
  hardwareId: string;
  date: string | null;
  optional: boolean;
}

export interface DriverScan {
  gpus: Gpu[];
  problemDevices: ProblemDevice[];
  updates: DriverUpdate[];
  updateError: string | null;
}

export interface DriverProgress {
  updateId: string;
  state: "downloading" | "installing" | "installed" | "failed";
  message: string;
}

export interface DriverInstallSummary {
  results: DriverProgress[];
  rebootRequired: boolean;
}

export const DEFAULT_ACCENT: Accent = {
  accent: "#0078D4",
  dark1: "#005A9E",
  dark2: "#004275",
  dark3: "#002642",
  light1: "#429CE3",
  light2: "#76B9ED",
  light3: "#A6D8FF",
};

type Unlisten = () => void;

// ---------------------------------------------------------------- mocks ----

type Handler = (payload: unknown) => void;
const mockHandlers = new Map<string, Set<Handler>>();
const mockEmit = (event: string, payload: unknown) =>
  mockHandlers.get(event)?.forEach((h) => h(payload));
const mockListen = (event: string, handler: Handler): Unlisten => {
  if (!mockHandlers.has(event)) mockHandlers.set(event, new Set());
  mockHandlers.get(event)!.add(handler);
  return () => mockHandlers.get(event)?.delete(handler);
};
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const mock = {
  installed: ["valve.steam", "7zip.7zip", "google.chrome", "microsoft.visualstudiocode"],

  async startInstall(ids: string[]) {
    ids.forEach((id) => mockEmit("install-progress", { id, state: "queued", message: "Waiting" }));
    const summary: InstallSummary = {
      installed: 0,
      alreadyInstalled: 0,
      failed: 0,
      rebootRequired: false,
      simulated: true,
    };
    for (const [i, id] of ids.entries()) {
      mockEmit("install-progress", { id, state: "installing", message: "Installing…" });
      await delay(1200);
      const failed = i === 2;
      if (failed) summary.failed++;
      else summary.installed++;
      mockEmit("install-progress", {
        id,
        state: failed ? "failed" : "installed",
        message: failed ? "Download failed (0x8A150008)" : "Simulated: nothing was installed",
      });
    }
    mockEmit("install-finished", summary);
  },

  scan: {
    gpus: [
      {
        name: "NVIDIA GeForce RTX 4070",
        vendor: "nvidia",
        driverVersion: "32.0.15.6094",
        driverDate: "2024-08-14",
        basicDriver: false,
        tool: { name: "NVIDIA App", wingetId: null, url: "https://www.nvidia.com/en-us/software/nvidia-app/" },
      },
      {
        name: "Intel(R) UHD Graphics 770",
        vendor: "intel",
        driverVersion: "31.0.101.4502",
        driverDate: "2023-06-20",
        basicDriver: false,
        tool: {
          name: "Intel Driver & Support Assistant",
          wingetId: "Intel.IntelDriverAndSupportAssistant",
          url: "https://www.intel.com/content/www/us/en/support/detect.html",
        },
      },
    ],
    problemDevices: [
      {
        name: "PCI Simple Communications Controller",
        deviceId: "PCI\\VEN_8086&DEV_7AE8&SUBSYS_00000000&REV_11\\3&11583659&0&B0",
        class: null,
        errorCode: 28,
        problem: "No driver is installed",
        hardwareIds: ["PCI\\VEN_8086&DEV_7AE8&REV_11", "PCI\\VEN_8086&DEV_7AE8"],
        fixUpdateId: "c1f2-mock-mei",
      },
    ],
    updates: [
      {
        updateId: "c1f2-mock-mei",
        title: "Intel - System - 2406.5.5.0",
        description: "Intel Management Engine Interface",
        driverClass: "System",
        provider: "Intel",
        manufacturer: "Intel",
        hardwareId: "PCI\\VEN_8086&DEV_7AE8",
        date: "2024-05-02",
        optional: true,
      },
      {
        updateId: "a9b8-mock-audio",
        title: "Realtek Semiconductor Corp. - Extension - 11.0.6000.1103",
        description: "Realtek audio extension",
        driverClass: "Extension",
        provider: "Realtek Semiconductor Corp.",
        manufacturer: "Realtek",
        hardwareId: "",
        date: "2024-03-18",
        optional: true,
      },
      {
        updateId: "77aa-mock-bt",
        title: "Intel(R) Wireless Bluetooth(R) - 23.60.5.10",
        description: "Bluetooth driver",
        driverClass: "Bluetooth",
        provider: "Intel",
        manufacturer: "Intel Corporation",
        hardwareId: "",
        date: "2024-06-11",
        optional: false,
      },
    ],
    updateError: null,
  } satisfies DriverScan,

  async installDrivers(updateIds: string[]): Promise<DriverInstallSummary> {
    const results: DriverProgress[] = [];
    for (const updateId of updateIds) {
      mockEmit("driver-progress", { updateId, state: "downloading", message: "Downloading…" });
      await delay(900);
      mockEmit("driver-progress", { updateId, state: "installing", message: "Installing…" });
      await delay(1100);
      const done: DriverProgress = { updateId, state: "installed", message: "Installed" };
      mockEmit("driver-progress", done);
      results.push(done);
    }
    return { results, rebootRequired: true };
  },
};

// ------------------------------------------------------------------ api ----

function on<T>(event: string, handler: (payload: T) => void): () => void {
  if (!isTauri) return mockListen(event, handler as Handler);
  let unlisten: Unlisten | undefined;
  let cancelled = false;
  listen<T>(event, (e) => handler(e.payload)).then((fn) => {
    if (cancelled) fn();
    else unlisten = fn;
  });
  return () => {
    cancelled = true;
    unlisten?.();
  };
}

export const api = {
  getAccent: (): Promise<Accent> =>
    isTauri ? invoke<Accent>("get_accent") : Promise.resolve(DEFAULT_ACCENT),

  getInstalled: async (): Promise<string[]> =>
    isTauri ? invoke<string[]>("get_installed") : (await delay(700), mock.installed),

  startInstall: (ids: string[], simulate: boolean): Promise<void> =>
    isTauri ? invoke("start_install", { ids, simulate }) : (void mock.startInstall(ids), Promise.resolve()),

  scanDrivers: async (): Promise<DriverScan> =>
    isTauri ? invoke<DriverScan>("scan_drivers") : (await delay(2500), mock.scan),

  createRestorePoint: async (): Promise<void> =>
    isTauri ? invoke<void>("create_restore_point") : delay(1500),

  installDrivers: (updateIds: string[]): Promise<DriverInstallSummary> =>
    isTauri ? invoke("install_drivers", { updateIds }) : mock.installDrivers(updateIds),

  showSnapLayouts: () => (isTauri ? invoke("show_snap_layouts") : Promise.resolve()),

  restartPc: (): Promise<void> => (isTauri ? invoke("restart_pc") : Promise.resolve()),

  openLogs: (): Promise<void> => (isTauri ? invoke("open_logs") : Promise.resolve()),

  openUrl: (url: string): Promise<void> =>
    isTauri ? openUrl(url) : (window.open(url, "_blank", "noopener"), Promise.resolve()),

  onInstallProgress: (h: (p: InstallProgress) => void) => on("install-progress", h),
  onInstallFinished: (h: (s: InstallSummary) => void) => on("install-finished", h),
  onDriverProgress: (h: (p: DriverProgress) => void) => on("driver-progress", h),
  onAccentChanged: (h: (a: Accent) => void) => on("accent-changed", h),
};

/** Writes UI-side events to the same log file as the backend. */
export function logError(context: string, err: unknown) {
  const text = `[ui] ${context}: ${err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err)}`;
  console.error(text);
  if (isTauri) void writeErrorLog(text).catch(() => undefined);
}

export function logInfo(text: string) {
  if (isTauri) void writeInfoLog(`[ui] ${text}`).catch(() => undefined);
}

// --------------------------------------------------------------- window ----

export const appWindow = {
  minimize: () => isTauri && getCurrentWindow().minimize(),
  toggleMaximize: () => isTauri && getCurrentWindow().toggleMaximize(),
  close: () => (isTauri ? getCurrentWindow().close() : undefined),
  setTheme: (theme: "light" | "dark" | null) => isTauri && getCurrentWindow().setTheme(theme),
  async isMaximized() {
    return isTauri ? getCurrentWindow().isMaximized() : false;
  },
  onResized(handler: () => void): () => void {
    if (!isTauri) {
      window.addEventListener("resize", handler);
      return () => window.removeEventListener("resize", handler);
    }
    let unlisten: Unlisten | undefined;
    getCurrentWindow().onResized(handler).then((fn) => (unlisten = fn));
    return () => unlisten?.();
  },
  onFocusChanged(handler: (focused: boolean) => void): () => void {
    if (!isTauri) return () => {};
    let unlisten: Unlisten | undefined;
    getCurrentWindow()
      .onFocusChanged(({ payload }) => handler(payload))
      .then((fn) => (unlisten = fn));
    return () => unlisten?.();
  },
};

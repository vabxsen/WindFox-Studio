import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  logError,
  logInfo,
  type DriverInstallSummary,
  type DriverProgress,
  type DriverScan,
  type InstallProgress,
  type InstallSummary,
} from "./api";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from "./settings";

export type Page =
  | { name: "home" }
  | { name: "welcome" }
  | { name: "apps"; category?: string; query?: string; suggested?: boolean }
  | { name: "install" }
  | { name: "drivers" }
  | { name: "settings" };

export type DriverPhase = "idle" | "scanning" | "restoring" | "installing" | "done";

interface AppState {
  ready: boolean;
  page: Page;
  navigate: (page: Page, options?: { replace?: boolean }) => void;
  back: () => void;
  canGoBack: boolean;

  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;

  /** Lower-case IDs; null while loading. */
  installed: Set<string> | null;
  installedError: string | null;
  refreshInstalled: () => void;

  selected: string[];
  toggleSelected: (id: string) => void;
  setSelected: (ids: string[]) => void;

  jobs: Map<string, InstallProgress>;
  jobOrder: string[];
  installRunning: boolean;
  installSummary: InstallSummary | null;
  startInstall: (ids: string[]) => Promise<void>;

  driverScan: DriverScan | null;
  driverPhase: DriverPhase;
  driverError: string | null;
  driverJobs: Map<string, DriverProgress>;
  driverRebootRequired: boolean;
  scanDrivers: () => Promise<void>;
  setDriverPhase: (phase: DriverPhase) => void;
  installDrivers: (ids: string[]) => Promise<void>;
  setDriverError: (error: string | null) => void;
}

const Ctx = createContext<AppState | null>(null);

/** Simulate mode: walk through the driver install states without touching Windows Update. */
async function simulateDriverInstall(
  ids: string[],
  report: (p: DriverProgress) => void,
): Promise<DriverInstallSummary> {
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const results: DriverProgress[] = [];
  for (const updateId of ids) {
    report({ updateId, state: "downloading", message: "Downloading… (simulated)" });
    await wait(700);
    report({ updateId, state: "installing", message: "Installing… (simulated)" });
    await wait(900);
    const done: DriverProgress = { updateId, state: "installed", message: "Simulated: nothing was installed" };
    report(done);
    results.push(done);
  }
  return { results, rebootRequired: false };
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState<Page[]>([{ name: "home" }]);
  const page = history[history.length - 1];

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [installed, setInstalled] = useState<Set<string> | null>(null);
  const [installedError, setInstalledError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const [jobs, setJobs] = useState<Map<string, InstallProgress>>(new Map());
  const [jobOrder, setJobOrder] = useState<string[]>([]);
  const [installRunning, setInstallRunning] = useState(false);
  const [installSummary, setInstallSummary] = useState<InstallSummary | null>(null);

  const [driverScan, setDriverScan] = useState<DriverScan | null>(null);
  const [driverPhase, setDriverPhase] = useState<DriverPhase>("idle");
  const [driverError, setDriverError] = useState<string | null>(null);
  const [driverJobs, setDriverJobs] = useState<Map<string, DriverProgress>>(new Map());
  const [driverRebootRequired, setDriverRebootRequired] = useState(false);

  // ---- navigation
  const navigate = useCallback((next: Page, options?: { replace?: boolean }) => {
    setHistory((h) => {
      const current = h[h.length - 1];
      if (JSON.stringify(current) === JSON.stringify(next)) return h;
      return options?.replace ? [...h.slice(0, -1), next] : [...h, next].slice(-50);
    });
  }, []);
  const back = useCallback(() => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h)), []);

  // ---- settings
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...patch };
    setSettings(next);
    void saveSettings(next);
  }, []);

  // ---- installed apps
  const refreshInstalled = useCallback(() => {
    setInstalledError(null);
    api
      .getInstalled()
      .then((ids) => setInstalled(new Set(ids.map((i) => i.toLowerCase()))))
      .catch((e) => {
        setInstalled(new Set());
        setInstalledError(String(e));
      });
  }, []);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      if (!s.onboarded) setHistory([{ name: "welcome" }]);
      setReady(true);
    });
    refreshInstalled();
  }, [refreshInstalled]);

  // ---- installs
  useEffect(() => {
    const offProgress = api.onInstallProgress((p) =>
      setJobs((prev) => new Map(prev).set(p.id, p)),
    );
    const offFinished = api.onInstallFinished((summary) => {
      setInstallSummary(summary);
      setInstallRunning(false);
      if (!summary.simulated) refreshInstalled();
    });
    return () => {
      offProgress();
      offFinished();
    };
  }, [refreshInstalled]);

  const startInstall = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      setJobs(new Map(ids.map((id) => [id, { id, state: "queued", message: "Waiting" }])));
      setJobOrder(ids);
      setInstallSummary(null);
      setInstallRunning(true);
      logInfo(`install requested: ${ids.join(", ")} (simulate: ${settingsRef.current.simulate})`);
      try {
        await api.startInstall(ids, settingsRef.current.simulate);
      } catch (e) {
        logError("start_install failed", e);
        setInstallRunning(false);
        setJobs(new Map(ids.map((id) => [id, { id, state: "failed", message: String(e) }])));
      }
    },
    [],
  );

  // ---- drivers
  useEffect(
    () => api.onDriverProgress((p) => setDriverJobs((prev) => new Map(prev).set(p.updateId, p))),
    [],
  );

  const scanDrivers = useCallback(async () => {
    setDriverPhase("scanning");
    setDriverError(null);
    setDriverJobs(new Map());
    setDriverRebootRequired(false);
    try {
      setDriverScan(await api.scanDrivers());
    } catch (e) {
      setDriverError(String(e));
    } finally {
      setDriverPhase("idle");
    }
  }, []);

  const installDrivers = useCallback(async (ids: string[]) => {
    setDriverPhase("installing");
    setDriverError(null);
    setDriverJobs(
      new Map(ids.map((updateId) => [updateId, { updateId, state: "downloading", message: "Waiting" }])),
    );
    try {
      const summary = settingsRef.current.simulate
        ? await simulateDriverInstall(ids, (p) => setDriverJobs((prev) => new Map(prev).set(p.updateId, p)))
        : await api.installDrivers(ids);
      setDriverRebootRequired(summary.rebootRequired);
      setDriverJobs((prev) => {
        const next = new Map(prev);
        summary.results.forEach((r) => next.set(r.updateId, r));
        return next;
      });
    } catch (e) {
      logError("install_drivers failed", e);
      setDriverError(String(e));
      setDriverJobs(new Map());
    } finally {
      setDriverPhase("done");
    }
  }, []);

  const toggleSelected = useCallback(
    (id: string) =>
      setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])),
    [],
  );

  const value = useMemo<AppState>(
    () => ({
      ready,
      page,
      navigate,
      back,
      canGoBack: history.length > 1,
      settings,
      updateSettings,
      installed,
      installedError,
      refreshInstalled,
      selected,
      toggleSelected,
      setSelected,
      jobs,
      jobOrder,
      installRunning,
      installSummary,
      startInstall,
      driverScan,
      driverPhase,
      driverError,
      driverJobs,
      driverRebootRequired,
      scanDrivers,
      setDriverPhase,
      installDrivers,
      setDriverError,
    }),
    [
      ready, page, navigate, back, history.length, settings, updateSettings, installed,
      installedError, refreshInstalled, selected, toggleSelected, jobs, jobOrder,
      installRunning, installSummary, startInstall, driverScan, driverPhase, driverError,
      driverJobs, driverRebootRequired, scanDrivers, installDrivers,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

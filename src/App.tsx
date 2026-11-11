import { FluentProvider } from "@fluentui/react-components";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, appWindow, DEFAULT_ACCENT, isTauri, logError, type Accent } from "./api";
import { SelectionBar } from "./components/SelectionBar";
import { AppsPage } from "./pages/Apps";
import { DriversPage } from "./pages/Drivers";
import { HomePage } from "./pages/Home";
import { InstallPage } from "./pages/Install";
import { SettingsPage } from "./pages/Settings";
import { WelcomePage } from "./pages/Welcome";
import { NavPane, type PaneMode } from "./shell/NavPane";
import { TitleBar } from "./shell/TitleBar";
import { AppProvider, useApp } from "./state";
import { applyAccentVariables, buildTheme } from "./theme";

function useSystemDark() {
  const query = "(prefers-color-scheme: dark)";
  const [dark, setDark] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return dark;
}

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

function Shell() {
  const { page, ready, settings } = useApp();
  const width = useWindowWidth();
  const [paneCollapsed, setPaneCollapsed] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const contentRef = useRef<HTMLElement>(null);

  // WinUI NavigationView thresholds: expanded ≥1008, compact ≥641, minimal below.
  const mode: PaneMode = width >= 1008 ? (paneCollapsed ? "compact" : "expanded") : width >= 641 ? "compact" : "minimal";
  useEffect(() => {
    setOverlayOpen(false);
  }, [mode]);

  // New page: scroll back to the top, like Frame navigation.
  // (Braces matter: newer Chromium returns a Promise from scrollTo.)
  useEffect(() => {
    void contentRef.current?.scrollTo({ top: 0 });
  }, [page]);

  const togglePane = () => {
    if (width >= 1008 && !overlayOpen) setPaneCollapsed((c) => !c);
    else setOverlayOpen((o) => !o);
  };

  const showSelectionBar = page.name === "home" || page.name === "apps";

  let content: React.ReactNode = null;
  switch (page.name) {
    case "home":
      content = <HomePage />;
      break;
    case "welcome":
      content = <WelcomePage />;
      break;
    case "apps":
      content = <AppsPage key={JSON.stringify(page)} category={page.category} query={page.query} suggested={page.suggested} />;
      break;
    case "install":
      content = <InstallPage />;
      break;
    case "drivers":
      content = <DriversPage />;
      break;
    case "settings":
      content = <SettingsPage />;
      break;
  }

  return (
    <div className={`app ${settings.simulate ? "simulating" : ""}`}>
      <TitleBar onTogglePane={togglePane} />
      <div className={`body pane-${mode}`}>
        <NavPane mode={mode} overlayOpen={overlayOpen} onNavigated={() => setOverlayOpen(false)} />
        {overlayOpen && <div className="nav-light-dismiss" onClick={() => setOverlayOpen(false)} />}
        <main className="content" ref={contentRef}>
          {ready && content}
          {showSelectionBar && <SelectionBar />}
        </main>
      </div>
    </div>
  );
}

function Themed() {
  const { settings } = useApp();
  const systemDark = useSystemDark();
  const [accent, setAccent] = useState<Accent>(DEFAULT_ACCENT);
  const mode = settings.theme === "system" ? (systemDark ? "dark" : "light") : settings.theme;

  useEffect(() => {
    api.getAccent().then(setAccent).catch(() => undefined);
    return api.onAccentChanged(setAccent);
  }, []);

  useEffect(() => {
    applyAccentVariables(accent);
  }, [accent]);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  // Keep Mica and the caption area in step with the app theme.
  useEffect(() => {
    void appWindow.setTheme(settings.theme === "system" ? null : settings.theme);
  }, [settings.theme]);

  const theme = useMemo(() => buildTheme(mode, accent), [mode, accent]);

  return (
    <FluentProvider theme={theme} className="fluent-root">
      <Shell />
    </FluentProvider>
  );
}

export default function App() {
  useEffect(() => {
    document.documentElement.classList.add(isTauri ? "mica" : "no-mica");
    // Feel like a desktop app: no browser context menu outside text fields.
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isTauri && !target.closest("input, textarea")) e.preventDefault();
    };
    window.addEventListener("contextmenu", onContextMenu);
    // Anything that goes wrong in the UI ends up in the app log too.
    const onError = (e: ErrorEvent) => logError("uncaught error", e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => logError("unhandled rejection", e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <AppProvider>
      <Themed />
    </AppProvider>
  );
}

import { SearchBox, Tooltip } from "@fluentui/react-components";
import { useEffect, useRef, useState } from "react";
import { api, appWindow } from "../api";
import { glyphs } from "../catalog";
import { Glyph } from "../components/basics";
import { useApp } from "../state";

/**
 * 48px title bar after WinUI Gallery's MainWindow TitleBar: back and pane
 * buttons, app icon and title, centered search (max 580px), and Windows 11
 * caption buttons. Hovering maximize opens Snap Layouts.
 */
export function TitleBar({ onTogglePane }: { onTogglePane: () => void }) {
  const { canGoBack, back, navigate, page } = useApp();
  const [maximized, setMaximized] = useState(false);
  const [focused, setFocused] = useState(true);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const snapTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const sync = () => void appWindow.isMaximized().then(setMaximized);
    sync();
    const offResize = appWindow.onResized(sync);
    const offFocus = appWindow.onFocusChanged(setFocused);
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      offResize();
      offFocus();
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const searching = page.name === "apps" && !!page.query;
  useEffect(() => {
    if (!searching) setQuery("");
  }, [searching]);

  const onSearch = (value: string) => {
    setQuery(value);
    if (value.trim()) navigate({ name: "apps", query: value }, { replace: searching });
    else if (searching) back();
  };

  const startSnapTimer = () => {
    window.clearTimeout(snapTimer.current);
    snapTimer.current = window.setTimeout(() => void api.showSnapLayouts(), 550);
  };
  const stopSnapTimer = () => window.clearTimeout(snapTimer.current);

  return (
    <header className={`titlebar ${focused ? "" : "inactive"}`} data-tauri-drag-region>
      <div className="titlebar-left" data-tauri-drag-region>
        <Tooltip content="Back" relationship="label">
          <button type="button" className="titlebar-button" onClick={back} disabled={!canGoBack}>
            <Glyph g={glyphs.back} size={16} />
          </button>
        </Tooltip>
        <Tooltip content="Open or close navigation" relationship="label">
          <button type="button" className="titlebar-button" onClick={onTogglePane}>
            <Glyph g={glyphs.menu} size={16} />
          </button>
        </Tooltip>
        <img src="/app-icon.svg" className="titlebar-icon" alt="" data-tauri-drag-region />
        <span className="titlebar-title type-caption" data-tauri-drag-region>
          WindFox Studio
        </span>
      </div>

      <div className="titlebar-center" data-tauri-drag-region>
        <SearchBox
          ref={searchRef}
          className="titlebar-search"
          placeholder="Search apps"
          aria-label="Search apps (Ctrl+F)"
          value={query}
          onChange={(_, data) => onSearch(data.value)}
        />
      </div>

      <div className="caption-buttons">
        <button type="button" className="caption-button" aria-label="Minimize" onClick={() => appWindow.minimize()}>
          <Glyph g={glyphs.minimize} size={10} />
        </button>
        <button
          type="button"
          className="caption-button"
          aria-label={maximized ? "Restore" : "Maximize"}
          onClick={() => {
            stopSnapTimer();
            appWindow.toggleMaximize();
          }}
          onMouseEnter={startSnapTimer}
          onMouseLeave={stopSnapTimer}
          onMouseDown={stopSnapTimer}
        >
          <Glyph g={maximized ? glyphs.restore : glyphs.maximize} size={10} />
        </button>
        <button type="button" className="caption-button close" aria-label="Close" onClick={() => appWindow.close()}>
          <Glyph g={glyphs.close} size={10} />
        </button>
      </div>
    </header>
  );
}

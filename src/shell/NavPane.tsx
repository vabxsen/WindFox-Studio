import { Tooltip } from "@fluentui/react-components";
import { useState } from "react";
import { categories, glyphs } from "../catalog";
import { Glyph } from "../components/basics";
import { useApp, type Page } from "../state";

export type PaneMode = "expanded" | "compact" | "minimal";

interface Item {
  key: string;
  label: string;
  glyph: string;
  page: Page;
  isActive: (page: Page) => boolean;
  badge?: string;
  children?: Item[];
}

/** NavigationView (Left) look: 36px items, 3×16 accent pill, Settings in the footer. */
export function NavPane({
  mode,
  overlayOpen,
  onNavigated,
}: {
  mode: PaneMode;
  overlayOpen: boolean;
  onNavigated: () => void;
}) {
  const { page, navigate, installRunning, jobs } = useApp();
  const [appsExpanded, setAppsExpanded] = useState(true);
  const showLabels = mode === "expanded" || overlayOpen;

  const activeJobs = [...jobs.values()].filter((j) => j.state === "queued" || j.state === "installing").length;

  const items: Item[] = [
    { key: "home", label: "Home", glyph: glyphs.home, page: { name: "home" }, isActive: (p) => p.name === "home" },
    {
      key: "apps",
      label: "Apps",
      glyph: glyphs.apps,
      page: { name: "apps" },
      isActive: (p) => p.name === "apps" && !p.category && !p.query,
      children: categories.map((c) => ({
        key: c.id,
        label: c.name,
        glyph: c.glyph,
        page: { name: "apps", category: c.id },
        isActive: (p: Page) => p.name === "apps" && p.category === c.id,
      })),
    },
    {
      key: "drivers",
      label: "Drivers",
      glyph: glyphs.drivers,
      page: { name: "drivers" },
      isActive: (p) => p.name === "drivers",
    },
    {
      key: "install",
      label: "Install",
      glyph: glyphs.download,
      page: { name: "install" },
      isActive: (p) => p.name === "install",
      badge: installRunning && activeJobs > 0 ? String(activeJobs) : undefined,
    },
  ];

  const settingsItem: Item = {
    key: "settings",
    label: "Settings",
    glyph: glyphs.settings,
    page: { name: "settings" },
    isActive: (p) => p.name === "settings",
  };

  const go = (item: Item) => {
    navigate(item.page);
    onNavigated();
  };

  const renderItem = (item: Item, depth = 0) => {
    const childActive = item.children?.some((c) => c.isActive(page)) ?? false;
    const expanded = item.key === "apps" && appsExpanded && showLabels;
    // A collapsed parent shows the selection of its hidden child, like WinUI.
    const active = item.isActive(page) || (childActive && !expanded);

    const button = (
      <button
        type="button"
        className={`nav-item ${active ? "active" : ""} ${depth ? "child" : ""}`}
        aria-current={active ? "page" : undefined}
        aria-expanded={item.children ? expanded : undefined}
        onClick={() => {
          if (item.children && showLabels) setAppsExpanded(item.isActive(page) ? !appsExpanded : true);
          go(item);
        }}
      >
        <span className="nav-indicator" />
        <span className="nav-icon">
          <Glyph g={item.glyph} size={16} />
        </span>
        {showLabels && <span className="nav-label type-body">{item.label}</span>}
        {item.badge && <span className={`nav-badge ${showLabels ? "" : "dot"}`}>{showLabels ? item.badge : ""}</span>}
        {item.children && showLabels && (
          <span
            className="nav-chevron"
            role="presentation"
            onClick={(e) => {
              e.stopPropagation();
              setAppsExpanded(!appsExpanded);
            }}
          >
            <Glyph g={expanded ? glyphs.chevronUp : glyphs.chevronDown} size={12} />
          </span>
        )}
      </button>
    );

    return (
      <li key={item.key}>
        {showLabels ? (
          button
        ) : (
          <Tooltip content={item.label} relationship="label" positioning="after">
            {button}
          </Tooltip>
        )}
        {expanded && item.children && (
          <ul className="nav-children">{item.children.map((c) => renderItem(c, depth + 1))}</ul>
        )}
      </li>
    );
  };

  return (
    <nav
      className={`nav mode-${mode} ${overlayOpen ? "overlay-open" : ""}`}
      aria-label="Main"
      aria-hidden={mode === "minimal" && !overlayOpen}
    >
      <ul className="nav-list">{items.map((i) => renderItem(i))}</ul>
      <ul className="nav-list nav-footer">{renderItem(settingsItem)}</ul>
    </nav>
  );
}

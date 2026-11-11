import { Tooltip } from "@fluentui/react-components";
import type { CatalogApp } from "../catalog";
import { useApp } from "../state";
import { AppIcon, CheckMark } from "./basics";

/** 300×96 card, after WinUI Gallery's ControlItemTemplate. */
export function AppCard({ app }: { app: CatalogApp }) {
  const { installed, selected, toggleSelected, jobs } = useApp();
  const isInstalled = installed?.has(app.id.toLowerCase()) ?? false;
  const job = jobs.get(app.id);
  const busy = job?.state === "queued" || job?.state === "installing";
  const isSelected = selected.includes(app.id);
  const selectable = !isInstalled && !busy;

  let strip: { text: string; tone: string } | null = null;
  if (job?.state === "installing") strip = { text: "Installing…", tone: "accent" };
  else if (job?.state === "queued") strip = { text: "Waiting to install", tone: "neutral" };
  else if (job?.state === "failed") strip = { text: "Install failed", tone: "critical" };
  else if (isInstalled) strip = { text: "Installed", tone: "success" };

  return (
    <div
      role="checkbox"
      aria-checked={isSelected}
      aria-disabled={!selectable}
      aria-label={`${app.name}. ${app.description}`}
      tabIndex={selectable ? 0 : -1}
      className={`app-card ${isSelected ? "selected" : ""} ${selectable ? "selectable" : ""} ${strip ? "has-strip" : ""}`}
      onClick={() => selectable && toggleSelected(app.id)}
      onKeyDown={(e) => {
        if (selectable && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          toggleSelected(app.id);
        }
      }}
    >
      <span className="app-card-icon">
        <AppIcon name={app.name} id={app.id} />
      </span>
      <span className="app-card-text">
        <span className="type-body-strong app-card-title">{app.name}</span>
        <Tooltip content={app.description} relationship="description" withArrow>
          <span className="type-caption text-secondary app-card-description">{app.description}</span>
        </Tooltip>
      </span>
      {selectable && (
        <span className="app-card-check">
          <CheckMark checked={isSelected} />
        </span>
      )}
      {strip && <span className={`app-card-strip tone-${strip.tone} type-caption`}>{strip.text}</span>}
    </div>
  );
}

export function AppGrid({ apps }: { apps: CatalogApp[] }) {
  return (
    <div className="app-grid">
      {apps.map((app) => (
        <AppCard key={app.id} app={app} />
      ))}
    </div>
  );
}

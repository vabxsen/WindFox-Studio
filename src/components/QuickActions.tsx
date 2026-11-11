/**
 * Home quick actions: two action cards and a "Browse apps" list card, after
 * the cards on Windows 11 Settings > Home (e.g. the Windows Update card with
 * its live status and "Check for updates" button).
 *
 * Tokens: acrylic fill + flyout stroke, OverlayCornerRadius (8) for cards,
 * ControlCornerRadius (4) for rows, 20px card padding, 12px gaps (4px grid),
 * WinUI type ramp (Subtitle titles, Body/Caption text), accent-text glyphs,
 * SystemFillColor{Success,Caution,Critical} for driver status.
 */
import { Button, Link, Spinner } from "@fluentui/react-components";
import { useId, type ReactNode } from "react";
import { categories, glyphs } from "../catalog";
import { useApp } from "../state";
import { Glyph } from "./basics";

const SHORT_NAMES: Record<string, string> = { ai: "AI tools" };

function ActionCard({
  glyph,
  title,
  children,
  action,
}: {
  glyph: string;
  title: string;
  children: ReactNode;
  action: ReactNode;
}) {
  const titleId = useId();
  return (
    <section className="action-card" aria-labelledby={titleId}>
      <Glyph g={glyph} size={28} className="action-card-glyph" />
      <div className="action-card-body">
        <h2 id={titleId} className="type-subtitle">
          {title}
        </h2>
        <div className="action-card-text type-body">{children}</div>
        <div className="action-card-action">{action}</div>
      </div>
    </section>
  );
}

function SetupCard() {
  const { navigate, settings } = useApp();
  const picked = categories.filter((c) => settings.interests.includes(c.id)).map((c) => SHORT_NAMES[c.id] ?? c.name);
  const tuned =
    picked.length === 0
      ? null
      : picked.length <= 2
        ? picked.join(" and ")
        : `${picked.slice(0, 2).join(", ")} and ${picked.length - 2} more`;

  return (
    <ActionCard
      glyph={glyphs.sparkle}
      title="Set up this PC"
      action={
        <Button appearance="primary" onClick={() => navigate({ name: "welcome" })}>
          {tuned ? "Change" : "Get started"}
        </Button>
      }
    >
      {tuned ? `Suggestions are tuned for ${tuned}.` : "Tell us what you use this PC for and we'll suggest apps."}
    </ActionCard>
  );
}

function DriverStatus() {
  const { driverScan: scan, driverPhase, driverError } = useApp();
  let glyph: string = glyphs.info;
  let tone = "neutral";
  let text = "Not checked yet. Find missing and newer drivers from Windows Update.";
  const scanning = driverPhase === "scanning";

  if (scanning) {
    text = "Checking Windows Update…";
  } else if (driverError) {
    glyph = glyphs.error;
    tone = "critical";
    text = "Couldn't check drivers.";
  } else if (scan) {
    const updates = scan.updates.length;
    const problems = scan.problemDevices.length;
    if (updates > 0) {
      glyph = glyphs.warning;
      tone = "caution";
      text = `${updates} driver ${updates === 1 ? "update" : "updates"} available`;
    } else if (problems > 0) {
      glyph = glyphs.warning;
      tone = "caution";
      text = `${problems} ${problems === 1 ? "device needs" : "devices need"} a driver`;
    } else {
      glyph = glyphs.completed;
      tone = "success";
      text = "Your drivers are up to date";
    }
  }
  // One persistent live region; only its contents change, so screen readers
  // announce every state (WCAG 4.1.3).
  return (
    <span className="status-line" role="status" aria-live="polite">
      {scanning ? <Spinner size="extra-tiny" /> : <Glyph g={glyph} size={16} className={`status-glyph tone-${tone}`} />}
      <span>{text}</span>
    </span>
  );
}

function DriversCard() {
  const { driverScan, driverPhase, driverError, scanDrivers, navigate } = useApp();
  const scanning = driverPhase === "scanning";
  const hasResult = !!driverScan && !driverError;

  return (
    <ActionCard
      glyph={glyphs.drivers}
      title="Drivers"
      action={
        hasResult ? (
          <Button onClick={() => navigate({ name: "drivers" })}>View drivers</Button>
        ) : (
          // disabledFocusable keeps keyboard focus on the button while scanning (WCAG 2.4.3).
          <Button disabledFocusable={scanning} onClick={() => void scanDrivers()}>
            {scanning ? "Scanning…" : driverError ? "Try again" : "Scan now"}
          </Button>
        )
      }
    >
      <DriverStatus />
    </ActionCard>
  );
}

function BrowseCard() {
  const { navigate } = useApp();
  const titleId = useId();
  return (
    <section className="browse-card" aria-labelledby={titleId}>
      <div className="browse-card-header">
        <h2 id={titleId} className="type-body-strong">
          Browse apps
        </h2>
        <Link onClick={() => navigate({ name: "apps" })}>All apps</Link>
      </div>
      <ul className="pack-list">
        {categories.map((c) => {
          const label = SHORT_NAMES[c.id] ?? c.name;
          return (
          <li key={c.id}>
            <button
              type="button"
              className="pack-row"
              onClick={() => navigate({ name: "apps", category: c.id })}
              // Starts with the visible label so voice control matches it (WCAG 2.5.3).
              aria-label={`${label}, ${c.apps.length} apps`}
            >
              <Glyph g={c.glyph} size={16} className="pack-row-glyph" />
              <span className="pack-row-name type-body">{label}</span>
              <span className="pack-row-count type-caption">{c.apps.length}</span>
              <Glyph g={glyphs.chevronRight} size={12} className="pack-row-chevron" />
            </button>
          </li>
          );
        })}
      </ul>
    </section>
  );
}

export function QuickActions() {
  return (
    <div className="quick-actions-wrap">
      <div className="quick-actions">
        <SetupCard />
        <DriversCard />
        <BrowseCard />
      </div>
    </div>
  );
}

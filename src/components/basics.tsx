import type { ReactNode } from "react";
import { logoFor } from "../logos";

export function Glyph({ g, size = 16, className = "" }: { g: string; size?: number; className?: string }) {
  return (
    <span className={`glyph ${className}`} style={{ fontSize: size, width: size, height: size }} aria-hidden>
      {g}
    </span>
  );
}

const PALETTE = [
  "#0F6CBD", "#C239B3", "#8764B8", "#107C10", "#CA5010", "#038387",
  "#E3008C", "#4F6BED", "#986F0B", "#5C2E91", "#00727D", "#D13438",
];

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** The app's official logo, or a colored letter tile when there is none. */
export function AppIcon({ name, id, size = 32 }: { name: string; id: string; size?: number }) {
  const logo = logoFor(id);
  if (logo) {
    return <img className="app-logo" src={logo} width={size} height={size} alt="" draggable={false} />;
  }
  const letter = name.replace(/[^A-Za-z0-9]/g, "").charAt(0).toUpperCase() || "?";
  return (
    <span
      className="app-icon"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.47),
        borderRadius: Math.max(4, Math.round(size * 0.2)),
        background: PALETTE[hash(id) % PALETTE.length],
      }}
      aria-hidden
    >
      {letter}
    </span>
  );
}

/** WinUI-style check box drawn in CSS (the card itself is the control). */
export function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span className={`checkmark ${checked ? "checked" : ""}`} aria-hidden>
      {checked && <Glyph g={""} size={12} />}
    </span>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="page-header-row">
        <h1 className="type-title" aria-level={1}>
          {title}
        </h1>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
      {description && <p className="type-body text-secondary page-header-description">{description}</p>}
    </header>
  );
}

export function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h2 className="section-header type-body-strong" aria-level={2}>
      {children}
    </h2>
  );
}

export function EmptyState({ glyph, title, children }: { glyph: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <Glyph g={glyph} size={36} className="empty-state-glyph" />
      <p className="type-body-strong">{title}</p>
      {children}
    </div>
  );
}

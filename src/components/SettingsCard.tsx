import { useId, useState, type ReactNode } from "react";
import { Glyph } from "./basics";

interface CardProps {
  icon?: ReactNode;
  header: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  onClick?: () => void;
  className?: string;
}

/** CommunityToolkit SettingsCard: icon, header, description, content on the right. */
export function SettingsCard({ icon, header, description, children, onClick, className = "" }: CardProps) {
  const body = (
    <>
      {icon && <span className="settings-card-icon">{icon}</span>}
      <span className="settings-card-text">
        <span className="type-body settings-card-header">{header}</span>
        {description && <span className="type-caption text-secondary settings-card-description">{description}</span>}
      </span>
      {children && <span className="settings-card-content">{children}</span>}
      {onClick && <Glyph g={""} size={12} className="settings-card-chevron" />}
    </>
  );
  return onClick ? (
    <button type="button" className={`settings-card clickable ${className}`} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={`settings-card ${className}`}>{body}</div>
  );
}

/** CommunityToolkit SettingsExpander: a card whose extra rows fold out below it. */
export function SettingsExpander({
  icon,
  header,
  description,
  content,
  children,
  defaultExpanded = false,
}: CardProps & { content?: ReactNode; defaultExpanded?: boolean }) {
  const [open, setOpen] = useState(defaultExpanded);
  const regionId = useId();
  return (
    <div className={`settings-expander ${open ? "open" : ""}`}>
      <div className="settings-card expander-header">
        {icon && <span className="settings-card-icon">{icon}</span>}
        <span className="settings-card-text">
          <span className="type-body settings-card-header">{header}</span>
          {description && <span className="type-caption text-secondary settings-card-description">{description}</span>}
        </span>
        {content && <span className="settings-card-content">{content}</span>}
        <button
          type="button"
          className="expander-toggle"
          aria-expanded={open}
          aria-controls={regionId}
          aria-label={open ? "Collapse" : "Expand"}
          onClick={() => setOpen((o) => !o)}
        >
          <Glyph g={open ? "" : ""} size={12} />
        </button>
      </div>
      {open && (
        <div className="expander-items" id={regionId}>
          {children}
        </div>
      )}
    </div>
  );
}

export function ExpanderItem({ header, children }: { header: ReactNode; children?: ReactNode }) {
  return (
    <div className="expander-item">
      <span className="type-body">{header}</span>
      {children && <span className="settings-card-content">{children}</span>}
    </div>
  );
}

import { Glyph } from "./basics";

interface TileProps {
  glyph: string;
  title: string;
  description: string;
  onClick: () => void;
  /** Toggle mode (Welcome page): shows a check badge when selected. */
  selected?: boolean;
  external?: boolean;
}

/** 232×172 acrylic tile, after WinUI Gallery's home header Tile. */
export function Tile({ glyph, title, description, onClick, selected, external }: TileProps) {
  const toggle = selected !== undefined;
  return (
    <button
      type="button"
      className={`tile ${selected ? "selected" : ""}`}
      onClick={onClick}
      role={toggle ? "checkbox" : undefined}
      aria-checked={toggle ? selected : undefined}
    >
      <span className="tile-icon">
        <Glyph g={glyph} size={18} />
      </span>
      <span className="tile-text">
        <span className="type-body-strong">{title}</span>
        <span className="type-caption text-secondary">{description}</span>
      </span>
      {toggle ? (
        selected && (
          <span className="tile-check">
            <Glyph g={""} size={12} />
          </span>
        )
      ) : (
        <Glyph g={external ? "" : ""} size={14} className="tile-corner-glyph" />
      )}
    </button>
  );
}

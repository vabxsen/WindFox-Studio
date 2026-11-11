import { useEffect, useRef, useState, type ReactNode } from "react";
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

/** Horizontally scrolling row with arrow buttons, like Gallery's HorizontalScrollContainer. */
export function HorizontalScroller({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 1,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
    });
  };

  useEffect(() => {
    update();
    const observer = new ResizeObserver(update);
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 488, behavior: "smooth" });

  return (
    <div className="hscroll">
      <div className="hscroll-track" ref={ref} onScroll={update}>
        {children}
      </div>
      {!edges.start && (
        <button type="button" className="hscroll-button start" aria-label="Scroll left" onClick={() => scroll(-1)}>
          <Glyph g={""} size={10} />
        </button>
      )}
      {!edges.end && (
        <button type="button" className="hscroll-button end" aria-label="Scroll right" onClick={() => scroll(1)}>
          <Glyph g={""} size={10} />
        </button>
      )}
    </div>
  );
}

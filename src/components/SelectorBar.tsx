import { Glyph } from "./basics";

export interface SelectorItem<T extends string> {
  key: T;
  label: string;
  glyph: string;
}

/** WinUI SelectorBar: text items with an accent pill under the selected one. */
export function SelectorBar<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: SelectorItem<T>[];
  value: T;
  onChange: (key: T) => void;
  label: string;
}) {
  return (
    <div className="selector-bar" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={item.key === value}
          className={`selector-item ${item.key === value ? "selected" : ""}`}
          onClick={() => onChange(item.key)}
        >
          <Glyph g={item.glyph} size={16} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

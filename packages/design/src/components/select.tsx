import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { cn } from "../lib/cn";
import "./select.css";

export interface SelectItem<T extends string = string> {
  readonly value: T;
  readonly label: string;
}

export interface SelectProps<T extends string = string> {
  value: T | undefined;
  onChange: (value: T) => void;
  items: ReadonlyArray<SelectItem<T>>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Sets `aria-label` on the trigger when no visible label is provided. */
  ariaLabel?: string;
}

export function Select<T extends string = string>({
  value,
  onChange,
  items,
  placeholder = "Select…",
  disabled = false,
  className,
  ariaLabel,
}: SelectProps<T>): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const valueId = useId();

  const selected = items.find((it) => it.value === value);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Sync highlight with selected on open
  useEffect(() => {
    if (!open) return;
    const idx = items.findIndex((it) => it.value === value);
    setHighlighted(idx >= 0 ? idx : 0);
  }, [open, items, value]);

  // Scroll highlighted into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlighted];
    if (el instanceof HTMLElement) el.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);

  const commit = (v: T): void => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>): void => {
    if (disabled) return;
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(items.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = items[highlighted];
      if (target) commit(target.value);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className={cn("ds-select", open && "open", disabled && "disabled", className)}
    >
      <button
        type="button"
        role="combobox"
        className="ds-select-trigger"
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-labelledby={ariaLabel ? undefined : valueId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((o) => !o);
        }}
        onKeyDown={onKeyDown}
      >
        <span className="ds-select-value" id={valueId}>
          {selected ? (
            selected.label
          ) : (
            <span className="ds-select-placeholder">{placeholder}</span>
          )}
        </span>
        <span className="ds-select-caret" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2.5 4L5 6.5L7.5 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      {open && (
        <div className="ds-select-menu" id={listboxId} role="listbox" ref={listRef}>
          {items.map((it, i) => (
            <button
              type="button"
              key={it.value}
              role="option"
              aria-selected={it.value === value}
              data-active={i === highlighted ? true : undefined}
              data-selected={it.value === value ? true : undefined}
              className="ds-select-option"
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => commit(it.value)}
            >
              <span className="ds-select-option-label">{it.label}</span>
              {it.value === value && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2.5 6.5L5 9L9.5 3.5"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

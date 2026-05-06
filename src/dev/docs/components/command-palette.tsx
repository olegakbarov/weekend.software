import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icon";
import { FLAT_ROUTES, type FlatRoute } from "../routes";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNav: (id: string) => void;
}

export function CommandPalette({
  open,
  onClose,
  onNav,
}: CommandPaletteProps): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset + autofocus on open
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIdx(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  // Match against name / group / id
  const matches = useMemo<ReadonlyArray<FlatRoute>>(() => {
    const q = query.toLowerCase().trim();
    if (!q) return FLAT_ROUTES;
    return FLAT_ROUTES.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.group.toLowerCase().includes(q) ||
        r.id.includes(q),
    );
  }, [query]);

  // Reset cursor when query changes
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(matches.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = matches[activeIdx];
        if (target) onNav(target.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, matches, activeIdx, onNav]);

  // Group filtered results in original group order
  const grouped = useMemo<ReadonlyArray<readonly [string, ReadonlyArray<FlatRoute>]>>(() => {
    const buckets = new Map<string, FlatRoute[]>();
    for (const m of matches) {
      const arr = buckets.get(m.group);
      if (arr) arr.push(m);
      else buckets.set(m.group, [m]);
    }
    return Array.from(buckets.entries());
  }, [matches]);

  return (
    <div
      className="cmd-overlay"
      data-open={open ? true : undefined}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="cmd"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search documentation"
      >
        <div className="cmd-input">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            placeholder="Search documentation, components, tokens…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              opacity: 0.5,
              padding: "1px 5px",
              border: "1px solid var(--border)",
              borderRadius: 4,
            }}
          >
            esc
          </kbd>
        </div>
        <div className="cmd-list">
          {grouped.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "var(--muted-foreground)",
                fontSize: 13,
              }}
            >
              No results for "{query}"
            </div>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group}>
                <div className="cmd-section">{group}</div>
                {items.map((it) => {
                  const i = matches.indexOf(it);
                  const isActive = i === activeIdx;
                  return (
                    <div
                      key={it.id}
                      className="cmd-item"
                      data-active={isActive ? true : undefined}
                      onMouseEnter={() => setActiveIdx(i)}
                      onClick={() => onNav(it.id)}
                      role="option"
                      aria-selected={isActive}
                    >
                      <Icon name={it.icon} size={14} className="ico" />
                      <span>{it.name}</span>
                      <span className="meta">{it.id}</span>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div
          style={{
            padding: "8px 14px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 16,
            fontSize: 10,
            color: "var(--muted-foreground)",
          }}
        >
          <span>
            <kbd style={{ fontFamily: "var(--font-mono)" }}>↑↓</kbd> navigate
          </span>
          <span>
            <kbd style={{ fontFamily: "var(--font-mono)" }}>↵</kbd> open
          </span>
          <span>
            <kbd style={{ fontFamily: "var(--font-mono)" }}>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

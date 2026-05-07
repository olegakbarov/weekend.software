import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import type { IconComponent } from "../lib/icon";
import "./seg.css";

export interface SegItem<T extends string | number = string> {
  readonly value: T;
  readonly label: string;
  readonly icon?: IconComponent;
}

export type SegVariant = "filled" | "subtle";

export interface SegProps<T extends string | number = string> {
  items: ReadonlyArray<SegItem<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Two-column grid layout. Only meaningful when `variant === "filled"`. */
  grid?: boolean;
  variant?: SegVariant;
  className?: string;
}

interface PlateRect {
  x: number;
  y: number;
  w: number;
  h: number;
  ready: boolean;
}

const INITIAL_PLATE: PlateRect = { x: 0, y: 0, w: 0, h: 0, ready: false };

export function Seg<T extends string | number = string>({
  items,
  value,
  onChange,
  grid = false,
  variant = "filled",
  className,
}: SegProps<T>): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [plate, setPlate] = useState<PlateRect>(INITIAL_PLATE);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const btn = root.querySelector<HTMLButtonElement>('button[data-active="true"]');
    if (!btn) {
      setPlate((p) => ({ ...p, ready: false }));
      return;
    }

    const measure = () => {
      setPlate({
        x: btn.offsetLeft,
        y: btn.offsetTop,
        w: btn.offsetWidth,
        h: btn.offsetHeight,
        ready: true,
      });
    };

    measure();

    // Active buttons transition `font-variation-settings` (medium ↔ semibold),
    // which changes their rendered width over ~150ms. The initial measurement
    // is taken pre-transition, so without re-measuring the plate ends up
    // offset relative to the post-transition layout. Observe every button so
    // we react to both the active button widening AND siblings shifting.
    const observer = new ResizeObserver(measure);
    root.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      observer.observe(b);
    });
    return () => observer.disconnect();
  }, [value, items, grid, variant]);

  const isSubtle = variant === "subtle";
  const rootClass = isSubtle ? "seg-subtle" : "seg";
  const plateClass = isSubtle ? "seg-subtle-plate" : "seg-plate";
  const plateStyle: React.CSSProperties = isSubtle
    ? { transform: `translateX(${plate.x}px)`, width: plate.w }
    : grid
      ? {
          transform: `translate(${plate.x}px, ${plate.y}px)`,
          width: plate.w,
          height: plate.h,
          top: 0,
          bottom: "auto",
          left: 0,
        }
      : { transform: `translateX(${plate.x}px)`, width: plate.w };

  return (
    <div
      ref={ref}
      className={cn(rootClass, !isSubtle && grid && "seg-grid", className)}
      role="tablist"
    >
      {plate.ready ? <span className={plateClass} style={plateStyle} aria-hidden="true" /> : null}
      {items.map((it) => {
        const Icon = it.icon;
        const active = value === it.value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            data-active={active ? true : undefined}
            onClick={() => onChange(it.value)}
          >
            {Icon ? <Icon size={12} /> : null}
            {Icon ? <span style={{ marginLeft: 6 }}>{it.label}</span> : it.label}
          </button>
        );
      })}
    </div>
  );
}

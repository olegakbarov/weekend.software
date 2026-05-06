import { useCallback, useRef } from "react";
import { cn } from "../lib/cn";
import "./slider.css";

export interface SliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  /** Format the readout next to the track. Defaults to the raw number. */
  format?: (value: number) => string;
  className?: string;
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

export function Slider({
  min,
  max,
  step = 1,
  value,
  onChange,
  format,
  className,
}: SliderProps): React.JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = ((value - min) / (max - min)) * 100;

  const updateFromX = useCallback(
    (clientX: number): void => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      const raw = min + ratio * (max - min);
      const stepped = Math.round(raw / step) * step;
      onChange(clamp(stepped, min, max));
    },
    [min, max, step, onChange],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    e.preventDefault();
    updateFromX(e.clientX);
    const onMove = (ev: PointerEvent): void => updateFromX(ev.clientX);
    const onUp = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className={cn("ds-slider", className)}>
      <div
        ref={trackRef}
        className="ds-slider-track"
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
        onPointerDown={onPointerDown}
      >
        <div className="ds-slider-fill" style={{ width: `${pct}%` }} />
        <div className="ds-slider-thumb" style={{ left: `${pct}%` }} />
      </div>
      <div className="ds-slider-value">{format ? format(value) : String(value)}</div>
    </div>
  );
}

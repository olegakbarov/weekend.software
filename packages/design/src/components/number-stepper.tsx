import { type ChangeEvent } from "react";
import { cn } from "../lib/cn";
import "./number-stepper.css";

export interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  ariaLabel?: string;
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

export function NumberStepper({
  value,
  onChange,
  min = 1,
  max = 9999,
  step = 1,
  className,
  ariaLabel,
}: NumberStepperProps): React.JSX.Element {
  const onInput = (e: ChangeEvent<HTMLInputElement>): void => {
    const v = Number.parseInt(e.target.value, 10);
    if (!Number.isNaN(v)) onChange(clamp(v, min, max));
  };

  return (
    <div className={cn("ds-number-stepper", className)} role="group" aria-label={ariaLabel}>
      <button
        type="button"
        onClick={() => onChange(clamp(value - step, min, max))}
        disabled={value <= min}
        aria-label="Decrease"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onInput}
        aria-label={ariaLabel}
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + step, min, max))}
        disabled={value >= max}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}

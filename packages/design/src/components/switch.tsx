import { forwardRef } from "react";
import { cn } from "../lib/cn";
import "./switch.css";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Required when there's no visible label associated with the switch. */
  ariaLabel?: string;
  className?: string;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onChange, disabled = false, ariaLabel, className },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      data-on={checked ? true : undefined}
      className={cn("ds-switch", className)}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
    />
  );
});

import type { InputHTMLAttributes } from "react";
import { cn } from "~/lib/utils";

export interface GmailSwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {}

export function GmailSwitch({
  className,
  checked = false,
  disabled,
  ...props
}: GmailSwitchProps) {
  return (
    <label
      className={cn(
        "relative inline-flex h-5 w-9 items-center",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <input
        checked={checked}
        className="peer sr-only"
        disabled={disabled}
        type="checkbox"
        {...props}
      />
      <span className="h-5 w-9 rounded-full border border-border bg-input transition-colors peer-checked:bg-primary" />
      <span className="pointer-events-none absolute left-0.5 size-4 rounded-full bg-background shadow transition-transform peer-checked:translate-x-4" />
    </label>
  );
}

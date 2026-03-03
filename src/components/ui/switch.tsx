import * as React from "react";

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  /** Size variant */
  size?: "sm" | "md";
  /** Label for the "off" state (left side) */
  offLabel?: string;
  /** Label for the "on" state (right side) */
  onLabel?: string;
}

/**
 * Standardized Switch component
 *
 * Toggle switch with optional labels on both sides.
 * Uses accent color for the active state indicator.
 */
const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      className = "",
      size = "md",
      checked,
      disabled,
      offLabel,
      onLabel,
      onChange,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: {
        track: "w-7 h-4",
        thumb: "size-3",
        translate: "translate-x-3",
        label: "text-[12px]",
      },
      md: {
        track: "w-9 h-5",
        thumb: "size-4",
        translate: "translate-x-4",
        label: "text-xs",
      },
    };

    const sizes = sizeClasses[size];

    return (
      <label
        className={`inline-flex select-none items-center gap-2 ${disabled ? "opacity-50" : ""} ${className}`}
      >
        {offLabel && (
          <span
            className={`font-vcr ${sizes.label} transition-colors ${
              checked ? "text-muted-foreground" : "text-accent"
            }`}
          >
            {offLabel}
          </span>
        )}
        <span className="relative inline-flex items-center">
          <input
            checked={checked}
            className="peer sr-only"
            disabled={disabled}
            onChange={onChange}
            ref={ref}
            type="checkbox"
            {...props}
          />
          <span
            className={`
              ${sizes.track} rounded-full border border-border bg-card transition-colors peer-focus-visible:ring-1 peer-focus-visible:ring-ring peer-disabled:peer-disabled:opacity-50`
              .replace(/\s+/g, " ")
              .trim()}
          />
          <span
            className={`absolute left-0.5 ${sizes.thumb} rounded-full bg-muted-foreground transition-all duration-200`
              .replace(/\s+/g, " ")
              .trim()}
            style={{
              transform: checked
                ? size === "sm"
                  ? "translateX(12px)"
                  : "translateX(16px)"
                : "translateX(0)",
              backgroundColor: checked ? "var(--accent)" : undefined,
            }}
          />
        </span>
        {onLabel && (
          <span
            className={`font-vcr ${sizes.label} transition-colors ${
              checked ? "text-accent" : "text-muted-foreground"
            }`}
          >
            {onLabel}
          </span>
        )}
      </label>
    );
  }
);
Switch.displayName = "Switch";

export { Switch };

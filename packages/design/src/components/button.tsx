import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "../lib/cn";
import type { IconComponent } from "../lib/icon";
import "./button.css";

/**
 * Button — pressable action.
 *
 * ## Upstream-canonical API
 * Mirrors fluid-functionalism `registry/default/button.tsx`:
 *   - variants: `primary` | `secondary` | `tertiary` | `ghost`
 *   - sizes:    `sm` | `md` | `lg`
 *   - props:    `icon`, `trailingIcon`, `loading`, `asChild`
 *   - default variant: `primary` (matches upstream)
 *   - icons are auto-sized per size token (sm:14, md:16, lg:20)
 *   - hover transitions stroke-width 1.5 → 2 on icons
 *
 * ## Weekend extensions
 *   - extra variants: `destructive`, `success`, `link`
 *     (absorbed Phase 4.4 — agents building app UIs in Weekend projects need
 *     these conventions; documented as intentional drift from upstream)
 *   - extra size: `xs` (22px tall — used in dense affordance rows like the
 *     project file-tree footer)
 *   - hover bumps `font-variation-settings` from medium → semibold; upstream
 *     leaves font-weight alone. Weekend signature, kept deliberately.
 *
 * ## Loading state
 * `loading` swaps the visible label/icons for an infinity-loop spinner driven
 * by the `spinner-move` + `spinner-dash` keyframes in tokens.css. The button
 * is disabled while loading and the original content is rendered as a hidden
 * ghost so layout stays stable.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "ghost"
  | "destructive"
  | "success"
  | "link";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon component (rendered before children). Auto-sized per `size`. */
  icon?: IconComponent;
  /** Trailing icon component (rendered after children). Auto-sized per `size`. */
  trailingIcon?: IconComponent;
  /** When true, swaps content for a spinner and disables the button. */
  loading?: boolean;
  asChild?: boolean;
}

/** Icon size in px keyed by button size. Matches upstream's iconSize map. */
const ICON_SIZE: Record<ButtonSize, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    icon: Icon,
    trailingIcon: TrailingIcon,
    loading = false,
    asChild = false,
    children,
    className,
    disabled,
    type = "button",
    ...props
  },
  ref,
) {
  const classes = cn("btn", `btn-${variant}`, size !== "md" && `btn-${size}`, className);
  const iconPx = ICON_SIZE[size];

  if (asChild) {
    // Slot requires a single child — asChild is intended for simple wrappers
    // (e.g. `<Link>`) where the consumer renders their own content. Slot
    // therefore drops the .btn-bg overlay and the spinner; loading + icons
    // shouldn't be combined with asChild.
    return (
      <Slot ref={ref} className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      <span className="btn-bg" aria-hidden="true" />
      {loading ? (
        <>
          {/* Hidden ghost content for layout stability. */}
          <span className="btn-loading-ghost" aria-hidden="true">
            {Icon ? <Icon size={iconPx} strokeWidth={2} /> : null}
            {children != null ? <span>{children}</span> : null}
            {TrailingIcon ? <TrailingIcon size={iconPx} strokeWidth={2} /> : null}
          </span>
          <span className="btn-spinner" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M 12 12 C 14 8.5 19 8.5 19 12 C 19 15.5 14 15.5 12 12 C 10 8.5 5 8.5 5 12 C 5 15.5 10 15.5 12 12 Z"
                stroke="currentColor"
                strokeWidth="1.125"
                strokeLinecap="round"
                pathLength={100}
              />
            </svg>
          </span>
        </>
      ) : (
        <>
          {Icon ? <Icon size={iconPx} strokeWidth={1.5} /> : null}
          {children != null ? <span>{children}</span> : null}
          {TrailingIcon ? <TrailingIcon size={iconPx} strokeWidth={1.5} /> : null}
        </>
      )}
    </button>
  );
});

export type IconButtonSize = "xs" | "sm" | "md" | "lg";

export interface IconButtonProps extends ComponentPropsWithoutRef<"button"> {
  icon: IconComponent;
  /** Accessible label — also used as the tooltip. */
  label: string;
  size?: IconButtonSize;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, size = "md", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn("btn-icon", `btn-icon-${size}`, className)}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon />
    </button>
  );
});

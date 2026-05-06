"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import { useShape } from "../lib/shape-context";

/**
 * Canonical badge color hex map. Re-exported as `BADGE_HEX` (Weekend's name —
 * existing consumers in the docs site rely on this) and `badgeColors` (upstream
 * name — kept for parity).
 */
export const BADGE_HEX = {
  gray: "#a3a3a3",
  red: "#ef4444",
  orange: "#f97316",
  amber: "#f59e0b",
  yellow: "#eab308",
  lime: "#84cc16",
  green: "#22c55e",
  emerald: "#10b981",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  blue: "#3b82f6",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  purple: "#a855f7",
  fuchsia: "#d946ef",
  pink: "#ec4899",
  rose: "#f43f5e",
} as const;

/** Upstream alias for `BADGE_HEX`. */
export const badgeColors = BADGE_HEX;

export type BadgeColor = keyof typeof BADGE_HEX;

export const badgeVariants = cva(
  "inline-flex items-center font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        solid: "",
        dot: "border border-border text-foreground",
      },
      size: {
        sm: "h-5 px-2 text-[11px] gap-1",
        md: "h-6 px-2.5 text-[12px] gap-1.5",
        lg: "h-7 px-3 text-[13px] gap-1.5",
      },
    },
    defaultVariants: {
      variant: "solid",
      size: "md",
    },
  },
);

export type BadgeVariant = "solid" | "dot";
export type BadgeSize = "sm" | "md" | "lg";

export interface BadgeProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "color">,
    VariantProps<typeof badgeVariants> {
  color?: BadgeColor;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  {
    className,
    variant = "solid",
    size = "md",
    color = "gray",
    children,
    style,
    ...props
  },
  ref,
) {
  const shape = useShape();
  const colorValue = BADGE_HEX[color];
  const isSolid = variant === "solid";
  const dotSize = size === "sm" ? 6 : size === "lg" ? 8 : 7;

  const colorStyle: React.CSSProperties = isSolid
    ? color === "gray"
      ? { backgroundColor: "var(--accent)", color: "var(--foreground)" }
      : {
          color: "var(--foreground)",
          backgroundColor: `color-mix(in srgb, ${colorValue} 15%, var(--background))`,
        }
    : {};

  const dotColor = color === "gray" ? "var(--muted-foreground)" : colorValue;

  return (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, size }), shape.item, className)}
      style={{ ...colorStyle, ...style }}
      {...props}
    >
      {!isSolid && (
        <span
          className="shrink-0 rounded-full"
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: dotColor,
          }}
        />
      )}
      {children}
    </span>
  );
});

Badge.displayName = "Badge";

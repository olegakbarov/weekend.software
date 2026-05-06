import { type ReactNode } from "react";
import { cn } from "../lib/cn";
import { fontWeights } from "../lib/font-weight";

export const BADGE_HEX = {
  gray: "#A3A3A3",
  red: "#EF4444",
  orange: "#F97316",
  amber: "#F59E0B",
  yellow: "#EAB308",
  lime: "#84CC16",
  green: "#22C55E",
  emerald: "#10B981",
  teal: "#14B8A6",
  cyan: "#06B6D4",
  blue: "#3B82F6",
  indigo: "#6366F1",
  violet: "#8B5CF6",
  purple: "#A855F7",
  fuchsia: "#D946EF",
  pink: "#EC4899",
  rose: "#F43F5E",
} as const;

export type BadgeColor = keyof typeof BADGE_HEX;
export type BadgeVariant = "solid" | "dot";
export type BadgeSize = "sm" | "md" | "lg";

interface BadgeProps {
  color?: BadgeColor;
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
  className?: string | undefined;
}

export function Badge({
  color = "gray",
  variant = "solid",
  size = "md",
  children,
  className,
}: BadgeProps): React.JSX.Element {
  const sizeClass =
    size === "sm" ? "h-[18px] px-1.5 text-[10px]" : size === "lg" ? "h-[26px] px-3 text-[12px]" : "h-[22px] px-2 text-[11px]";
  const baseClass = cn(
    "inline-flex items-center gap-1 rounded-full",
    sizeClass,
    className,
  );
  const fontStyle = { fontVariationSettings: fontWeights.medium };

  if (variant === "dot") {
    return (
      <span
        className={cn(
          baseClass,
          "bg-card border border-border text-foreground",
        )}
        style={fontStyle}
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: color === "gray" ? "var(--muted-foreground)" : BADGE_HEX[color] }}
        />
        {children}
      </span>
    );
  }

  const bgStyle: React.CSSProperties =
    color === "gray"
      ? { background: "var(--accent)", ...fontStyle }
      : {
          background: `color-mix(in srgb, ${BADGE_HEX[color]} 15%, var(--card))`,
          ...fontStyle,
        };

  return (
    <span className={cn(baseClass, "text-foreground")} style={bgStyle}>
      {children}
    </span>
  );
}

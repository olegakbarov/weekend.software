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
  children: React.ReactNode;
}

export function Badge({
  color = "gray",
  variant = "solid",
  size = "md",
  children,
}: BadgeProps): React.JSX.Element {
  const sizeClass = size === "sm" ? "badge-sm" : size === "lg" ? "badge-lg" : "";
  const hex = BADGE_HEX[color];

  if (variant === "dot") {
    return (
      <span
        className={`badge ${sizeClass}`.trim()}
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
        }}
      >
        <span
          className="dot"
          style={{
            background: color === "gray" ? "var(--muted-foreground)" : hex,
          }}
        />
        {children}
      </span>
    );
  }

  const style: React.CSSProperties =
    color === "gray"
      ? { background: "var(--accent)", color: "var(--foreground)" }
      : {
          background: `color-mix(in srgb, ${hex} 15%, var(--card))`,
          color: "var(--foreground)",
        };

  return (
    <span className={`badge ${sizeClass}`.trim()} style={style}>
      {children}
    </span>
  );
}

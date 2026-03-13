import type { CSSProperties, ReactNode } from "react";
import {
  Tooltip,
  type TooltipContentProps,
  type TooltipProps,
} from "recharts";

export type ChartConfig = Record<
  string,
  {
    label: string;
    color: string;
  }
>;

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function ChartContainer({
  children,
  className,
  config,
}: {
  children: ReactNode;
  className?: string;
  config: ChartConfig;
}) {
  const style = Object.fromEntries(
    Object.entries(config).map(([key, value]) => [`--color-${key}`, value.color]),
  ) as CSSProperties;

  return (
    <div className={joinClassNames("chart-frame", className)} style={style}>
      {children}
    </div>
  );
}

export const ChartTooltip = Tooltip;

export function ChartTooltipContent({
  active,
  config,
  label,
  payload,
  valueFormatter,
}: Partial<TooltipContentProps<number, string>> & {
  config: ChartConfig;
  valueFormatter?: (value: number, key: string) => string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{String(label ?? "")}</p>
      <div className="chart-tooltip-grid">
        {payload.map((item) => {
          const key =
            typeof item.dataKey === "string"
              ? item.dataKey
              : typeof item.name === "string"
                ? item.name
                : "value";
          const chart = config[key];
          const numericValue = Number(item.value ?? 0);

          return (
            <div key={key} className="chart-tooltip-row">
              <span
                className="chart-tooltip-swatch"
                style={{ background: chart?.color ?? item.color ?? "#111111" }}
              />
              <span>{chart?.label ?? key}</span>
              <strong>
                {valueFormatter ? valueFormatter(numericValue, key) : numericValue}
              </strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

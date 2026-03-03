import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

const ENTITY_ID_STYLES = {
  task: {
    label: "TASK",
    labelClassName: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  session: {
    label: "SESSION",
    labelClassName: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  },
} as const;

export type EntityIdKind = keyof typeof ENTITY_ID_STYLES;

interface EntityIdBadgeProps {
  kind: EntityIdKind;
  value: string;
  copyText?: string;
  className?: string;
}

export function EntityIdBadge({
  kind,
  value,
  copyText,
  className,
}: EntityIdBadgeProps) {
  const config = ENTITY_ID_STYLES[kind];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded border border-border/60 bg-secondary/40 px-2 py-1 text-[12px]",
        className
      )}
    >
      <span
        className={cn(
          "rounded border px-1.5 py-0.5 font-vcr text-[11px]",
          config.labelClassName
        )}
      >
        {config.label}
      </span>
      <span className="font-mono text-[12px] text-foreground">{value}</span>
      {copyText ? <CopyButton size="sm" text={copyText} /> : null}
    </div>
  );
}

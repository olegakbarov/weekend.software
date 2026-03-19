export function ProjectStatusDot({ running }: { running: boolean }) {
  return (
    <span
      className={`inline-block size-1.5 shrink-0 rounded-full transition-colors ${
        running
          ? "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]"
          : "bg-muted-foreground/25"
      }`}
    />
  );
}

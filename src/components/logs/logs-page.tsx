import { Button } from "@/components/ui/button";

export type WeekendLogsSnapshot = {
  backend: string;
  frontend: string;
};

function renderLogContent(content: string | null | undefined): string {
  if (!content) return "No logs yet.";
  const trimmed = content.trim();
  return trimmed ? trimmed : "No logs yet.";
}

export type LogsPageProps = {
  weekendLogs: WeekendLogsSnapshot | null;
  error: string | null;
  isRefreshing: boolean;
  onRefresh: () => void;
};

export function LogsPage({
  weekendLogs,
  error,
  isRefreshing,
  onRefresh,
}: LogsPageProps) {
  const frontendLogs = weekendLogs
    ? renderLogContent(weekendLogs.frontend)
    : "Loading logs...";
  const backendLogs = weekendLogs
    ? renderLogContent(weekendLogs.backend)
    : "Loading logs...";

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden px-4 py-3">
      <div className="flex items-center gap-2">
        <h1 className="font-code text-xs tracking-wide text-foreground">Logs</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button
            className="h-7 px-2 font-code text-[12px]"
            onClick={onRefresh}
            size="sm"
            variant="ghost"
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mt-2 font-code text-xs text-destructive">{error}</p>
      ) : null}

      <div className="mt-2 grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
        <section className="flex min-h-0 flex-col rounded border border-border/50 bg-background/30">
          <div className="flex items-center justify-between border-border/50 border-b px-2 py-1">
            <p className="font-code text-[12px] tracking-wide text-muted-foreground">
              Weekend Software FE
            </p>
          </div>
          <pre className="min-h-0 flex-1 overflow-auto px-2 py-1.5 font-code text-[13px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {frontendLogs}
          </pre>
        </section>

        <section className="flex min-h-0 flex-col rounded border border-border/50 bg-background/30">
          <div className="flex items-center justify-between border-border/50 border-b px-2 py-1">
            <p className="font-code text-[12px] tracking-wide text-muted-foreground">
              Weekend Software BE
            </p>
          </div>
          <pre className="min-h-0 flex-1 overflow-auto px-2 py-1.5 font-code text-[13px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {backendLogs}
          </pre>
        </section>
      </div>
    </section>
  );
}

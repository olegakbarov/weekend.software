import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LogsPage } from "@/components/logs/logs-page";
import { useLogs } from "@/hooks/use-logs";

export const Route = createFileRoute("/logs")({
  component: LogsRoute,
});

function LogsRoute() {
  const { weekendLogsSnapshot, isRefreshing, error, refresh } = useLogs();

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <LogsPage
      weekendLogs={weekendLogsSnapshot}
      error={error}
      isRefreshing={isRefreshing}
      onRefresh={refresh}
    />
  );
}

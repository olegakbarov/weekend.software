import { useCallback, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { WeekendLogsSnapshot } from "@/components/logs/logs-page";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useLogs() {
  const [weekendLogsSnapshot, setWeekendLogsSnapshot] =
    useState<WeekendLogsSnapshot | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRefreshingRef = useRef(false);

  const refresh = useCallback(() => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    setError(null);

    void invoke<WeekendLogsSnapshot>("logs_read_weekend", { maxBytes: 200000 })
      .then((weekendLogs) => {
        setWeekendLogsSnapshot(weekendLogs);
      })
      .catch((err) => {
        setError(toErrorMessage(err));
      })
      .finally(() => {
        isRefreshingRef.current = false;
        setIsRefreshing(false);
      });
  }, []);

  return { weekendLogsSnapshot, isRefreshing, error, refresh };
}

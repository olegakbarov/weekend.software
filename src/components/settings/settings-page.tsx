import {
  THEME_NAMES,
  type ThemeName,
} from "@/components/theme/theme-provider";
import { useTheme } from "@/components/theme/use-theme";
import { Button } from "@/components/ui/button";
import { Switch } from "@weekend/design";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@weekend/design/registry";
import {
  type RuntimeDebugSnapshot,
  type RuntimeTelemetryEvent,
} from "@/lib/controller";
import type { WeekendLogsSnapshot } from "@/components/logs/logs-page";

function formatTimestamp(unixMs: number): string {
  if (!Number.isFinite(unixMs) || unixMs <= 0) return "n/a";
  try {
    return new Date(unixMs).toLocaleString();
  } catch {
    return String(unixMs);
  }
}

function formatRuntimeDebugDump(snapshot: RuntimeDebugSnapshot): string {
  const lines: string[] = [];
  lines.push(`Generated: ${formatTimestamp(snapshot.generatedAtUnixMs)}`);
  lines.push("");
  lines.push(`Terminal Sessions (${snapshot.terminalIds.length})`);
  for (const terminalId of snapshot.terminalIds) {
    lines.push(`- ${terminalId}`);
  }
  if (snapshot.terminalIds.length === 0) {
    lines.push("- none");
  }

  return lines.join("\n");
}

function formatRuntimeTelemetryValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value == null) return "null";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatRuntimeTelemetryDump(events: RuntimeTelemetryEvent[]): string {
  if (events.length === 0) {
    return "No runtime telemetry events recorded yet.";
  }

  const lines: string[] = [];
  for (const entry of events.slice().reverse()) {
    lines.push(
      `${formatTimestamp(entry.atUnixMs)} | ${entry.event} | id=${entry.id}`
    );
    const payloadEntries = Object.entries(entry.payload);
    if (payloadEntries.length === 0) {
      lines.push("  payload: {}");
    } else {
      for (const [key, value] of payloadEntries) {
        lines.push(`  ${key}: ${formatRuntimeTelemetryValue(value)}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export type SettingsPageProps = {
  snapshot: RuntimeDebugSnapshot | null;
  error: string | null;
  isRefreshing: boolean;
  onRefreshRuntimeSnapshot: () => void;
  runtimeTelemetryEvents: RuntimeTelemetryEvent[];
  isVimModeEnabled: boolean;
  onVimModeEnabledChange: (enabled: boolean) => void;
  showArchivedApps: boolean;
  onShowArchivedAppsChange: (enabled: boolean) => void;
  weekendLogs: WeekendLogsSnapshot | null;
  logsError: string | null;
  isLogsRefreshing: boolean;
  onRefreshLogs: () => void;
};

const THEME_LABELS: Record<ThemeName, string> = {
  fluid: "Fluid · light",
  "fluid-dark": "Fluid · dark",
  "weekend-dark": "Weekend · dark",
  "weekend-paper": "Weekend · paper",
};

export function SettingsPage({
  snapshot,
  error,
  isRefreshing,
  onRefreshRuntimeSnapshot,
  runtimeTelemetryEvents,
  isVimModeEnabled,
  onVimModeEnabledChange,
  showArchivedApps,
  onShowArchivedAppsChange,
  weekendLogs,
  logsError,
  isLogsRefreshing,
  onRefreshLogs,
}: SettingsPageProps) {
  const { activeTheme, setActiveTheme } = useTheme();

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden p-6">
      <h1 className="font-code text-sm text-foreground">Settings</h1>

      <Tabs className="mt-4 min-h-0 flex-1" defaultValue="basic">
        <TabsList>
          <TabsTrigger className="font-code text-xs" value="basic">Basic</TabsTrigger>
          <TabsTrigger className="font-code text-xs" value="logs">Logs</TabsTrigger>
          <TabsTrigger className="font-code text-xs" value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* ── Basic ── */}
        <TabsContent className="overflow-auto" value="basic">
          <div className="space-y-3">
            {/* Theme */}
            <div className="flex items-center justify-between rounded border border-border/70 bg-background/60 px-3 py-2.5">
              <div>
                <p className="font-code text-xs text-foreground">Theme</p>
                <p className="font-code text-[11px] text-muted-foreground">
                  Pick the active theme. Applies across all windows.
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {THEME_NAMES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTheme(t)}
                    className={`rounded px-2.5 py-1 font-code text-xs transition-colors ${
                      activeTheme === t
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {THEME_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Vim Mode */}
            <div className="flex items-center justify-between rounded border border-border/70 bg-background/60 px-3 py-2.5">
              <div>
                <p className="font-code text-xs text-foreground">Vim Mode</p>
                <p className="font-code text-[11px] text-muted-foreground">
                  Enable Vim keybindings in all project editors.
                </p>
              </div>
              <Switch
                checked={isVimModeEnabled}
                onChange={onVimModeEnabledChange}
                ariaLabel="Vim Mode"
              />
            </div>

            {/* Show Archived Apps */}
            <div className="flex items-center justify-between rounded border border-border/70 bg-background/60 px-3 py-2.5">
              <div>
                <p className="font-code text-xs text-foreground">Show Archived Apps</p>
                <p className="font-code text-[11px] text-muted-foreground">
                  Display archived projects in the sidebar.
                </p>
              </div>
              <Switch
                checked={showArchivedApps}
                onChange={onShowArchivedAppsChange}
                ariaLabel="Show Archived Apps"
              />
            </div>
          </div>
        </TabsContent>

        {/* ── Logs ── */}
        <TabsContent className="flex min-h-0 flex-1 flex-col overflow-hidden" value="logs">
          <div className="flex min-h-0 flex-1 flex-col rounded border border-border/70 bg-background/60 p-3">
            <div className="flex items-center justify-between">
              <p className="font-code text-[11px] text-muted-foreground">
                Weekend Software frontend &amp; backend logs.
              </p>
              <Button
                className="h-7 px-2 font-code text-[10px]"
                onClick={onRefreshLogs}
                size="sm"
                variant="ghost"
              >
                {isLogsRefreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>

            {logsError ? (
              <p className="font-code text-xs text-destructive">{logsError}</p>
            ) : null}

            <div className="mt-2 grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex min-h-0 flex-col rounded border border-border/70 bg-[var(--feature-input-body-bg)]">
                <div className="border-b border-border/60 px-2 py-1">
                  <p className="font-code text-[11px] text-muted-foreground">Frontend</p>
                </div>
                <pre className="min-h-0 flex-1 overflow-auto px-2 py-1.5 font-code text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {weekendLogs ? (weekendLogs.frontend.trim() || "No logs yet.") : "Loading logs..."}
                </pre>
              </div>
              <div className="flex min-h-0 flex-col rounded border border-border/70 bg-[var(--feature-input-body-bg)]">
                <div className="border-b border-border/60 px-2 py-1">
                  <p className="font-code text-[11px] text-muted-foreground">Backend</p>
                </div>
                <pre className="min-h-0 flex-1 overflow-auto px-2 py-1.5 font-code text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {weekendLogs ? (weekendLogs.backend.trim() || "No logs yet.") : "Loading logs..."}
                </pre>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Advanced ── */}
        <TabsContent className="overflow-auto" value="advanced">
          <div className="space-y-3">
            {/* Runtime Debug */}
            <div className="space-y-2 rounded border border-border/70 bg-background/60 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-code text-xs text-foreground">Runtime Debug</p>
                  <p className="font-code text-[11px] text-muted-foreground">
                    Backend runtime snapshot (terminal sessions).
                  </p>
                </div>
                <Button
                  className="h-7 px-2 font-code text-[10px]"
                  onClick={onRefreshRuntimeSnapshot}
                  size="sm"
                  variant="ghost"
                >
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </Button>
              </div>

              {error ? (
                <p className="font-code text-xs text-destructive">{error}</p>
              ) : null}

              <pre className="min-h-0 overflow-auto rounded border border-border/70 bg-[var(--feature-input-body-bg)] p-3 font-code text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {snapshot ? formatRuntimeDebugDump(snapshot) : "Loading runtime state..."}
              </pre>
            </div>

            {/* Runtime Telemetry */}
            <div className="space-y-2 rounded border border-border/70 bg-background/60 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-code text-xs text-foreground">Runtime Telemetry</p>
                  <p className="font-code text-[11px] text-muted-foreground">
                    Recent `runtime_*` events emitted by the workspace controller.
                  </p>
                </div>
                <p className="font-code text-[11px] text-muted-foreground">
                  {runtimeTelemetryEvents.length} event(s)
                </p>
              </div>

              <pre className="min-h-0 max-h-64 overflow-auto rounded border border-border/70 bg-[var(--feature-input-body-bg)] p-3 font-code text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {formatRuntimeTelemetryDump(runtimeTelemetryEvents)}
              </pre>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}

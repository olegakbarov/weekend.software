import { Check } from "lucide-react";
import {
  THEME_NAMES,
  type ThemeName,
} from "@/components/theme/theme-provider";
import { useTheme } from "@/components/theme/use-theme";
import { Button } from "@/components/ui/button";
import { Switch } from "@weekend/design";
import {
  type RuntimeDebugSnapshot,
  type RuntimeTelemetryEvent,
  type AgentProfile,
  type AgentProvider,
  type AgentSettings,
  type SharedAssetSnapshot,
} from "@/lib/controller";
import type { WeekendLogsSnapshot } from "@/components/logs/logs-page";
import { SharedPage } from "@/components/shared/shared-page";
import {
  isBuiltInAgentProfile,
  normalizeAgentSettings,
  slugifyAgentProfileId,
} from "@/lib/controller/agent-profiles";
import type { SettingsTab } from "@/components/settings/settings-tabs";

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
  activeTab: SettingsTab;
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
  agentSettings: AgentSettings;
  onAgentSettingsChange: (settings: AgentSettings) => void;
  sharedAssets: SharedAssetSnapshot[];
  sharedAssetsError: string | null;
  isSharedLoading: boolean;
  isSharedUploading: boolean;
  onRefreshShared: () => void;
  onUploadShared: (files: File[]) => Promise<void>;
  onRenameShared: (fileName: string, newFileName: string) => Promise<void>;
  onDeleteShared: (fileName: string) => Promise<void>;
  sharedEnv: Record<string, string>;
  onUpdateSharedEnv: (env: Record<string, string>) => Promise<void>;
};

type ThemePreview = {
  label: string;
  bg: string;
  fg: string;
  muted: string;
  primary: string;
  border: string;
};

const THEME_PREVIEWS: Record<ThemeName, ThemePreview> = {
  fluid: {
    label: "Fluid · light",
    bg: "#fafafa",
    fg: "#171717",
    muted: "#e5e5e5",
    primary: "#171717",
    border: "#e5e5e5",
  },
  "fluid-dark": {
    label: "Fluid · dark",
    bg: "#171717",
    fg: "#f5f5f5",
    muted: "#404040",
    primary: "#f5f5f5",
    border: "#404040",
  },
  "weekend-dark": {
    label: "Weekend · dark",
    bg: "#000000",
    fg: "#A7A7A7",
    muted: "#2D2D2D",
    primary: "#DEDEDE",
    border: "#2D2D2D",
  },
  "weekend-paper": {
    label: "Weekend · paper",
    bg: "#F5F0EB",
    fg: "#2C2420",
    muted: "#D8D0C8",
    primary: "#2C2420",
    border: "#D8D0C8",
  },
};

const AGENT_PROVIDERS: ReadonlyArray<{ value: AgentProvider; label: string }> = [
  { value: "claude-code", label: "Claude Code" },
  { value: "codex", label: "Codex" },
  { value: "custom", label: "Custom" },
];

function updateAgentProfile(
  settings: AgentSettings,
  profileId: string,
  updater: (profile: AgentProfile) => AgentProfile
): AgentSettings {
  return normalizeAgentSettings({
    ...settings,
    profiles: settings.profiles.map((profile) =>
      profile.id === profileId ? updater(profile) : profile
    ),
  });
}

export function SettingsPage({
  activeTab,
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
  agentSettings,
  onAgentSettingsChange,
  sharedAssets,
  sharedAssetsError,
  isSharedLoading,
  isSharedUploading,
  onRefreshShared,
  onUploadShared,
  onRenameShared,
  onDeleteShared,
  sharedEnv,
  onUpdateSharedEnv,
}: SettingsPageProps) {
  const { activeTheme, setActiveTheme } = useTheme();

  const addAgentProfile = () => {
    let suffix = agentSettings.profiles.length + 1;
    let id = `custom-${suffix}`;
    const usedIds = new Set(agentSettings.profiles.map((profile) => profile.id));
    while (usedIds.has(id)) {
      suffix += 1;
      id = `custom-${suffix}`;
    }
    onAgentSettingsChange(
      normalizeAgentSettings({
        ...agentSettings,
        profiles: [
          ...agentSettings.profiles,
          {
            id,
            label: "Custom agent",
            provider: "custom",
            command: "agent",
            sessionIdStrategy: "none",
            resumeCommand: null,
          },
        ],
      })
    );
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden p-6">
      {activeTab === "basic" ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="space-y-3">
            {/* Theme */}
            <div className="rounded border border-border/70 bg-background/60 px-3 py-2.5">
              <div className="mb-2">
                <p className="font-code text-xs text-foreground">Theme</p>
                <p className="font-code text-[11px] text-muted-foreground">
                  Pick the active theme. Applies across all windows.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {THEME_NAMES.map((name) => {
                  const t = THEME_PREVIEWS[name];
                  const isActive = activeTheme === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setActiveTheme(name)}
                      aria-pressed={isActive}
                      className={
                        "group relative flex flex-col overflow-hidden rounded border text-left outline-none transition-all duration-150 " +
                        (isActive
                          ? "border-foreground ring-2 ring-foreground/50 ring-offset-2 ring-offset-background shadow-md"
                          : "border-border/70 opacity-70 hover:border-foreground/40 hover:opacity-100")
                      }
                    >
                      {isActive ? (
                        <span
                          aria-hidden
                          className="absolute right-1.5 top-1.5 z-10 flex size-4 items-center justify-center rounded-full shadow-sm"
                          style={{ background: t.primary, color: t.bg }}
                        >
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      ) : null}
                      <div
                        className="flex h-12 items-center gap-2 px-2.5"
                        style={{
                          background: t.bg,
                          borderBottom: `1px solid ${t.border}`,
                        }}
                      >
                        <span
                          aria-hidden
                          className="size-3 shrink-0 rounded-full"
                          style={{ background: t.primary }}
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span
                            aria-hidden
                            className="block h-1 w-3/4 rounded-full"
                            style={{ background: t.fg }}
                          />
                          <span
                            aria-hidden
                            className="block h-1 w-1/2 rounded-full"
                            style={{ background: t.muted }}
                          />
                        </div>
                      </div>
                      <div
                        className={
                          "px-2.5 py-1.5 transition-colors " +
                          (isActive ? "bg-foreground/[0.04]" : "")
                        }
                      >
                        <p
                          className={
                            "font-code text-[11px] " +
                            (isActive
                              ? "font-medium text-foreground"
                              : "text-muted-foreground")
                          }
                        >
                          {t.label}
                        </p>
                      </div>
                    </button>
                  );
                })}
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
        </div>
      ) : null}

      {activeTab === "agents" ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="space-y-3">
            <div className="rounded border border-border/70 bg-background/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-code text-xs text-foreground">Agent Profiles</p>
                  <p className="font-code text-[11px] text-muted-foreground">
                    Profiles define launch and resume semantics for agent terminals.
                  </p>
                </div>
                <Button
                  className="h-7 px-2 font-code text-[10px]"
                  onClick={addAgentProfile}
                  size="sm"
                  variant="ghost"
                >
                  Add
                </Button>
              </div>

              <div className="mt-3 space-y-2">
                {agentSettings.profiles.map((profile) => {
                  const isDefault = profile.id === agentSettings.defaultProfileId;
                  const builtIn = isBuiltInAgentProfile(profile.id);
                  return (
                    <div
                      key={profile.id}
                      className="grid gap-2 rounded border border-border/60 bg-card p-2 md:grid-cols-[minmax(120px,1fr)_150px_minmax(180px,1.5fr)_150px_auto]"
                    >
                      <input
                        className="h-8 min-w-0 rounded border border-border/60 bg-background px-2 font-code text-[11px] text-foreground outline-none"
                        value={profile.label}
                        onChange={(event) =>
                          onAgentSettingsChange(
                            updateAgentProfile(agentSettings, profile.id, (current) => ({
                              ...current,
                              label: event.target.value,
                              id: builtIn
                                ? current.id
                                : slugifyAgentProfileId(event.target.value) || current.id,
                            }))
                          )
                        }
                        aria-label={`${profile.label} label`}
                      />
                      <select
                        className="h-8 rounded border border-border/60 bg-background px-2 font-code text-[11px] text-foreground outline-none"
                        value={profile.provider}
                        onChange={(event) =>
                          onAgentSettingsChange(
                            updateAgentProfile(agentSettings, profile.id, (current) => ({
                              ...current,
                              provider: event.target.value as AgentProvider,
                              sessionIdStrategy:
                                event.target.value === "claude-code"
                                  ? "preseed-uuid"
                                  : event.target.value === "codex"
                                    ? "hook-json"
                                    : current.sessionIdStrategy,
                            }))
                          )
                        }
                        aria-label={`${profile.label} provider`}
                      >
                        {AGENT_PROVIDERS.map((provider) => (
                          <option key={provider.value} value={provider.value}>
                            {provider.label}
                          </option>
                        ))}
                      </select>
                      <input
                        className="h-8 min-w-0 rounded border border-border/60 bg-background px-2 font-code text-[11px] text-foreground outline-none"
                        value={profile.command}
                        onChange={(event) =>
                          onAgentSettingsChange(
                            updateAgentProfile(agentSettings, profile.id, (current) => ({
                              ...current,
                              command: event.target.value,
                            }))
                          )
                        }
                        aria-label={`${profile.label} command`}
                      />
                      <select
                        className="h-8 rounded border border-border/60 bg-background px-2 font-code text-[11px] text-foreground outline-none"
                        value={profile.sessionIdStrategy}
                        onChange={(event) =>
                          onAgentSettingsChange(
                            updateAgentProfile(agentSettings, profile.id, (current) => ({
                              ...current,
                              sessionIdStrategy: event.target.value as AgentProfile["sessionIdStrategy"],
                            }))
                          )
                        }
                        aria-label={`${profile.label} session id strategy`}
                      >
                        <option value="preseed-uuid">preseed uuid</option>
                        <option value="hook-json">hook json</option>
                        <option value="stdout-json">stdout json</option>
                        <option value="stdout-regex">stdout regex</option>
                        <option value="filesystem">filesystem</option>
                        <option value="none">none</option>
                      </select>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          className="h-7 px-2 font-code text-[10px]"
                          onClick={() =>
                            onAgentSettingsChange({
                              ...agentSettings,
                              defaultProfileId: profile.id,
                            })
                          }
                          size="sm"
                          variant={isDefault ? "secondary" : "ghost"}
                        >
                          Default
                        </Button>
                        {!builtIn ? (
                          <Button
                            className="h-7 px-2 font-code text-[10px] text-destructive"
                            onClick={() =>
                              onAgentSettingsChange(
                                normalizeAgentSettings({
                                  ...agentSettings,
                                  profiles: agentSettings.profiles.filter(
                                    (candidate) => candidate.id !== profile.id
                                  ),
                                  defaultProfileId: isDefault
                                    ? agentSettings.profiles[0]?.id
                                    : agentSettings.defaultProfileId,
                                })
                              )
                            }
                            size="sm"
                            variant="ghost"
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "shared" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <SharedPage
            sharedAssets={sharedAssets}
            sharedAssetsError={sharedAssetsError}
            isLoading={isSharedLoading}
            isUploading={isSharedUploading}
            onRefresh={onRefreshShared}
            onUpload={onUploadShared}
            onRename={onRenameShared}
            onDelete={onDeleteShared}
            sharedEnv={sharedEnv}
            onUpdateSharedEnv={onUpdateSharedEnv}
          />
        </div>
      ) : null}

      {activeTab === "logs" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
              <div className="flex min-h-0 flex-col rounded border border-border/70 bg-card">
                <div className="border-b border-border/60 px-2 py-1">
                  <p className="font-code text-[11px] text-muted-foreground">Frontend</p>
                </div>
                <pre className="min-h-0 flex-1 overflow-auto px-2 py-1.5 font-code text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {weekendLogs ? (weekendLogs.frontend.trim() || "No logs yet.") : "Loading logs..."}
                </pre>
              </div>
              <div className="flex min-h-0 flex-col rounded border border-border/70 bg-card">
                <div className="border-b border-border/60 px-2 py-1">
                  <p className="font-code text-[11px] text-muted-foreground">Backend</p>
                </div>
                <pre className="min-h-0 flex-1 overflow-auto px-2 py-1.5 font-code text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {weekendLogs ? (weekendLogs.backend.trim() || "No logs yet.") : "Loading logs..."}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "advanced" ? (
        <div className="min-h-0 flex-1 overflow-auto">
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

              <pre className="min-h-0 overflow-auto rounded border border-border/70 bg-card p-3 font-code text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
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

              <pre className="min-h-0 max-h-64 overflow-auto rounded border border-border/70 bg-card p-3 font-code text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {formatRuntimeTelemetryDump(runtimeTelemetryEvents)}
              </pre>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

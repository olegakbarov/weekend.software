import { useRef, useState } from "react";
import { useTheme } from "@/components/theme/use-theme";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type RuntimeDebugSnapshot,
  type RuntimeTelemetryEvent,
  type SharedAssetSnapshot,
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

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "n/a";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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
  sharedAssets: SharedAssetSnapshot[];
  sharedAssetsError: string | null;
  isSharedAssetsLoading: boolean;
  isSharedAssetsUploading: boolean;
  onRefreshSharedAssets: () => void;
  onUploadSharedAssets: (files: File[]) => Promise<void>;
  onRenameSharedAsset: (fileName: string, newFileName: string) => Promise<void>;
  onDeleteSharedAsset: (fileName: string) => Promise<void>;
  weekendLogs: WeekendLogsSnapshot | null;
  logsError: string | null;
  isLogsRefreshing: boolean;
  onRefreshLogs: () => void;
};

const THEME_MODES = ["light", "dark", "system"] as const;

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
  sharedAssets,
  sharedAssetsError,
  isSharedAssetsLoading,
  isSharedAssetsUploading,
  onRefreshSharedAssets,
  onUploadSharedAssets,
  onRenameSharedAsset,
  onDeleteSharedAsset,
  weekendLogs,
  logsError,
  isLogsRefreshing,
  onRefreshLogs,
}: SettingsPageProps) {
  const { mode, setMode } = useTheme();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [renamingFileName, setRenamingFileName] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pendingDeleteFileName, setPendingDeleteFileName] = useState<string | null>(
    null
  );

  const handleUpload = () => {
    if (selectedFiles.length === 0 || isSharedAssetsUploading) return;
    void onUploadSharedAssets(selectedFiles)
      .then(() => {
        setSelectedFiles([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      })
      .catch(() => undefined);
  };

  const startRenameSharedAsset = (fileName: string) => {
    if (isSharedAssetsUploading) return;
    setRenamingFileName(fileName);
    setRenameDraft(fileName);
  };

  const cancelRenameSharedAsset = () => {
    setRenamingFileName(null);
    setRenameDraft("");
  };

  const submitRenameSharedAsset = (fileName: string) => {
    if (isSharedAssetsUploading) return;
    const trimmed = renameDraft.trim();
    if (!trimmed || trimmed === fileName) {
      cancelRenameSharedAsset();
      return;
    }
    if (trimmed.includes("/") || trimmed.includes("\\")) {
      return;
    }

    void onRenameSharedAsset(fileName, trimmed)
      .then(() => {
        cancelRenameSharedAsset();
      })
      .catch(() => undefined);
  };

  const requestDeleteSharedAsset = (fileName: string) => {
    if (isSharedAssetsUploading) return;
    setPendingDeleteFileName(fileName);
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden p-6">
      <h1 className="font-code text-sm text-foreground">Settings</h1>

      <Tabs className="mt-4 min-h-0 flex-1" defaultValue="basic">
        <TabsList>
          <TabsTrigger className="font-code text-xs" value="basic">Basic</TabsTrigger>
          <TabsTrigger className="font-code text-xs" value="files">Files</TabsTrigger>
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
                  Switch between light, dark, or system theme.
                </p>
              </div>
              <div className="flex gap-1">
                {THEME_MODES.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`rounded px-2.5 py-1 font-code text-xs transition-colors ${
                      mode === m
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {m}
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
                onChange={(event) =>
                  onVimModeEnabledChange(event.currentTarget.checked)
                }
                size="md"
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
                onChange={(event) =>
                  onShowArchivedAppsChange(event.currentTarget.checked)
                }
                size="md"
              />
            </div>
          </div>
        </TabsContent>

        {/* ── Files ── */}
        <TabsContent className="overflow-auto" value="files">
          <div className="space-y-3">
            <div className="space-y-3 rounded border border-border/70 bg-background/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-code text-xs text-foreground">Shared Files</p>
                  <p className="font-code text-[11px] text-muted-foreground">
                    Files copied into every project at `./shared-assets/`.
                  </p>
                </div>
                <Button
                  className="h-7 px-2 font-code text-[10px]"
                  disabled={isSharedAssetsLoading || isSharedAssetsUploading}
                  onClick={onRefreshSharedAssets}
                  size="sm"
                  variant="ghost"
                >
                  {isSharedAssetsLoading ? "Refreshing..." : "Refresh"}
                </Button>
              </div>

              <div className="space-y-2">
                <input
                  className="block w-full cursor-pointer rounded border border-border/70 bg-background px-3 py-2 font-code text-xs text-foreground file:mr-2 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:font-code file:text-[11px]"
                  multiple
                  onChange={(event) => {
                    const files = event.currentTarget.files;
                    setSelectedFiles(files ? Array.from(files) : []);
                  }}
                  ref={fileInputRef}
                  type="file"
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="font-code text-[11px] text-muted-foreground">
                    {selectedFiles.length === 0
                      ? "No files selected."
                      : `${selectedFiles.length} file(s) selected.`}
                  </p>
                  <Button
                    className="h-7 px-2 font-code text-[10px]"
                    disabled={selectedFiles.length === 0 || isSharedAssetsUploading}
                    onClick={handleUpload}
                    size="sm"
                    variant="ghost"
                  >
                    {isSharedAssetsUploading ? "Uploading..." : "Upload To All Projects"}
                  </Button>
                </div>
              </div>

              {sharedAssetsError ? (
                <p className="font-code text-xs text-destructive">{sharedAssetsError}</p>
              ) : null}

              <div className="rounded border border-border/70 bg-[var(--feature-input-body-bg)]">
                <div className="border-b border-border/60 px-3 py-2 font-code text-[11px] text-muted-foreground">
                  {sharedAssets.length} shared file(s)
                </div>
                {sharedAssets.length === 0 ? (
                  <p className="px-3 py-3 font-code text-xs text-muted-foreground">
                    No shared assets yet.
                  </p>
                ) : (
                  <ul className="max-h-64 divide-y divide-border/40 overflow-auto">
                    {sharedAssets.map((asset) => (
                      <li
                        className="flex items-center justify-between gap-3 px-3 py-2 font-code text-xs"
                        key={asset.fileName}
                      >
                        <div className="min-w-0">
                          {renamingFileName === asset.fileName ? (
                            <div className="space-y-2">
                              <Input
                                autoFocus
                                className="h-7 px-2 font-code text-[11px]"
                                onChange={(event) => {
                                  setRenameDraft(event.currentTarget.value);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    submitRenameSharedAsset(asset.fileName);
                                  } else if (event.key === "Escape") {
                                    event.preventDefault();
                                    cancelRenameSharedAsset();
                                  }
                                }}
                                value={renameDraft}
                              />
                              <p className="text-[11px] text-muted-foreground">
                                {formatFileSize(asset.sizeBytes)} ·{" "}
                                {asset.modifiedAtUnixMs
                                  ? formatTimestamp(asset.modifiedAtUnixMs)
                                  : "n/a"}
                              </p>
                            </div>
                          ) : (
                            <>
                              <p className="truncate text-foreground">{asset.fileName}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {formatFileSize(asset.sizeBytes)} ·{" "}
                                {asset.modifiedAtUnixMs
                                  ? formatTimestamp(asset.modifiedAtUnixMs)
                                  : "n/a"}
                              </p>
                            </>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {renamingFileName === asset.fileName ? (
                            <>
                              <Button
                                className="h-6 px-2 font-code text-[10px]"
                                disabled={isSharedAssetsUploading}
                                onClick={() => {
                                  submitRenameSharedAsset(asset.fileName);
                                }}
                                size="sm"
                                variant="ghost"
                              >
                                Save
                              </Button>
                              <Button
                                className="h-6 px-2 font-code text-[10px]"
                                disabled={isSharedAssetsUploading}
                                onClick={cancelRenameSharedAsset}
                                size="sm"
                                variant="ghost"
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                className="h-6 px-2 font-code text-[10px]"
                                disabled={isSharedAssetsUploading}
                                onClick={() => {
                                  startRenameSharedAsset(asset.fileName);
                                }}
                                size="sm"
                                variant="ghost"
                              >
                                Rename
                              </Button>
                              <Button
                                className="h-6 px-2 font-code text-[10px] text-destructive hover:text-destructive"
                                disabled={isSharedAssetsUploading}
                                onClick={() => {
                                  requestDeleteSharedAsset(asset.fileName);
                                }}
                                size="sm"
                                variant="ghost"
                              >
                                Remove
                              </Button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
      <ConfirmDialog
        cancelText="Cancel"
        confirmText="Remove"
        message={
          pendingDeleteFileName
            ? `Remove "${pendingDeleteFileName}" from Shared Files and every project copy?`
            : ""
        }
        onConfirm={() => {
          const target = pendingDeleteFileName;
          if (!target) return;
          void onDeleteSharedAsset(target).catch(() => undefined);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteFileName(null);
          }
        }}
        open={pendingDeleteFileName !== null}
        title="Remove shared file?"
        variant="danger"
      />
    </section>
  );
}

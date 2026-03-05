import { useRef, useState } from "react";
import { useTheme } from "@/components/theme/use-theme";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  type RuntimeDebugSnapshot,
  type RuntimeTelemetryEvent,
  type SharedAssetSnapshot,
} from "@/lib/controller";

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
  sharedAssets: SharedAssetSnapshot[];
  sharedAssetsError: string | null;
  isSharedAssetsLoading: boolean;
  isSharedAssetsUploading: boolean;
  onRefreshSharedAssets: () => void;
  onUploadSharedAssets: (files: File[]) => Promise<void>;
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
  sharedAssets,
  sharedAssetsError,
  isSharedAssetsLoading,
  isSharedAssetsUploading,
  onRefreshSharedAssets,
  onUploadSharedAssets,
}: SettingsPageProps) {
  const { mode, setMode } = useTheme();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden p-6">
      <h1 className="font-code text-sm text-foreground">Settings</h1>

      <div className="mt-4 min-h-0 flex-1 space-y-6 overflow-auto">
        {/* ── Basic ── */}
        <div className="space-y-3">
          <h2 className="font-code text-xs uppercase tracking-wider text-muted-foreground">
            Basic
          </h2>

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

          {/* Shared Files */}
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
                      className="flex items-center justify-between gap-2 px-3 py-2 font-code text-xs"
                      key={asset.fileName}
                    >
                      <span className="truncate text-foreground">{asset.fileName}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatFileSize(asset.sizeBytes)} ·{" "}
                        {asset.modifiedAtUnixMs
                          ? formatTimestamp(asset.modifiedAtUnixMs)
                          : "n/a"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* ── Advanced ── */}
        <div className="space-y-3">
          <button
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="flex w-full items-center gap-1.5 font-code text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
          >
            <span
              className="inline-block transition-transform"
              style={{ transform: showAdvanced ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              ▶
            </span>
            Advanced
          </button>

          {showAdvanced && (
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
          )}
        </div>
      </div>
    </section>
  );
}

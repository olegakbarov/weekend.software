import { useRef, useState } from "react";
import { useTheme } from "@/components/theme/use-theme";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type RuntimeDebugSnapshot,
  type SharedAssetSnapshot,
} from "@/lib/workspace-controller";

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
      <Tabs className="mt-3 min-h-0 flex-1" defaultValue="shared-assets">
        <TabsList className="font-code text-xs">
          <TabsTrigger value="shared-assets">Shared Assets</TabsTrigger>
          <TabsTrigger value="debug">Debug</TabsTrigger>
        </TabsList>

        <TabsContent className="min-h-0 overflow-auto" value="shared-assets">
          <div className="space-y-4 rounded border border-border/70 bg-background/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-code text-xs text-foreground">Global Shared Assets</p>
                <p className="font-code text-[11px] text-muted-foreground">
                  Uploaded files are copied into every project at `./shared-assets/`.
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
        </TabsContent>

        <TabsContent className="min-h-0 overflow-auto" value="debug">
          <div className="flex items-center justify-between">
            <h2 className="font-code text-sm text-foreground">Debug</h2>
            <Button
              className="h-7 px-2 font-code text-[10px]"
              onClick={onRefreshRuntimeSnapshot}
              size="sm"
              variant="ghost"
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="font-code text-xs text-muted-foreground">Theme</span>
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

          <div className="mt-3 flex items-start justify-between rounded border border-border/70 bg-background/60 px-3 py-2">
            <div>
              <p className="font-code text-xs text-foreground">Editor / Vim Mode</p>
              <p className="font-code text-[11px] text-muted-foreground">
                Enable Vim keybindings (Esc, i, h, j, k, l) in all project editors.
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

          <p className="mt-2 font-code text-xs text-muted-foreground">
            Backend runtime snapshot (terminal sessions only).
          </p>

          {error ? (
            <p className="mt-3 font-code text-xs text-destructive">{error}</p>
          ) : null}

          <pre className="mt-3 min-h-0 flex-1 overflow-auto rounded border border-border/70 bg-[var(--feature-input-body-bg)] p-3 font-code text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {snapshot ? formatRuntimeDebugDump(snapshot) : "Loading runtime state..."}
          </pre>
        </TabsContent>
      </Tabs>
    </section>
  );
}

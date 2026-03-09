import { useEffect, useEffectEvent, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import {
  getCurrentWebviewWindow,
  type DragDropEvent,
} from "@tauri-apps/api/webviewWindow";
import {
  AlertTriangle,
  ArrowDownToLine,
  Files,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { SharedAssetSnapshot } from "@/lib/controller";
import { hasTauriRuntime } from "@/lib/tauri-mock";
import { cn } from "@/lib/utils";
import { toErrorMessage } from "@/lib/utils/error";

export const Route = createFileRoute("/shared-drop")({
  component: SharedDropRoute,
});

function sortSharedAssets(
  assets: SharedAssetSnapshot[]
): SharedAssetSnapshot[] {
  return assets.slice().sort((left, right) => {
    const leftModified = left.modifiedAtUnixMs ?? 0;
    const rightModified = right.modifiedAtUnixMs ?? 0;
    if (leftModified !== rightModified) {
      return rightModified - leftModified;
    }
    return left.fileName.localeCompare(right.fileName);
  });
}

function formatTimestamp(unixMs: number | null): string {
  if (!Number.isFinite(unixMs) || unixMs == null || unixMs <= 0) return "n/a";
  try {
    return new Date(unixMs).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(unixMs);
  }
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "n/a";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getPathBaseName(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return path;
  const segments = trimmed.split(/[\\/]/);
  return segments[segments.length - 1] ?? trimmed;
}

function formatPathSummary(paths: string[]): string | null {
  if (paths.length === 0) return null;
  if (paths.length === 1) return getPathBaseName(paths[0]!);
  return `${getPathBaseName(paths[0]!)} +${paths.length - 1} more`;
}

function SharedDropRoute() {
  const [assets, setAssets] = useState<SharedAssetSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [draggedPaths, setDraggedPaths] = useState<string[]>([]);
  const [activeImportCount, setActiveImportCount] = useState(0);
  const [activeMutationFileName, setActiveMutationFileName] = useState<string | null>(null);
  const [activeMutationAction, setActiveMutationAction] = useState<"rename" | "delete" | null>(
    null
  );
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);
  const [renamingFileName, setRenamingFileName] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const hasRuntime = hasTauriRuntime();

  const refreshAssets = useEffectEvent(async () => {
    if (!hasRuntime) {
      setError("Shared drop requires the desktop app runtime.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextAssets = await invoke<SharedAssetSnapshot[]>("shared_assets_list");
      setAssets(sortSharedAssets(nextAssets));
    } catch (nextError) {
      setError(toErrorMessage(nextError));
    } finally {
      setIsLoading(false);
    }
  });

  const importPaths = useEffectEvent(async (paths: string[]) => {
    const nextPaths = Array.from(
      new Set(paths.map((path) => path.trim()).filter((path) => path.length > 0))
    );
    if (nextPaths.length === 0 || !hasRuntime || isImporting || isMutating) return;

    setIsImporting(true);
    setActiveImportCount(nextPaths.length);
    setError(null);
    setLastSyncMessage(null);

    try {
      await invoke("shared_assets_import_paths", {
        paths: nextPaths,
      });
      const nextAssets = await invoke<SharedAssetSnapshot[]>("shared_assets_list");
      setAssets(sortSharedAssets(nextAssets));
      setLastSyncMessage(
        `Imported ${nextPaths.length} file${nextPaths.length === 1 ? "" : "s"} into Shared Files.`
      );
    } catch (nextError) {
      setError(toErrorMessage(nextError));
    } finally {
      setActiveImportCount(0);
      setIsImporting(false);
    }
  });

  const renameAsset = useEffectEvent(async (fileName: string, newFileName: string) => {
    if (!hasRuntime || isImporting || isMutating) return;

    const currentName = fileName.trim();
    const nextName = newFileName.trim();
    if (!currentName || !nextName || currentName === nextName) return;

    setIsMutating(true);
    setActiveMutationAction("rename");
    setActiveMutationFileName(currentName);
    setError(null);
    setLastSyncMessage(null);

    try {
      const nextAssets = await invoke<SharedAssetSnapshot[]>("shared_assets_rename", {
        fileName: currentName,
        newFileName: nextName,
      });
      setAssets(sortSharedAssets(nextAssets));
      setLastSyncMessage(`Renamed ${currentName} to ${nextName}.`);
    } catch (nextError) {
      setError(toErrorMessage(nextError));
      throw nextError;
    } finally {
      setActiveMutationFileName(null);
      setActiveMutationAction(null);
      setIsMutating(false);
    }
  });

  const deleteAsset = useEffectEvent(async (fileName: string) => {
    if (!hasRuntime || isImporting || isMutating) return;

    const normalizedName = fileName.trim();
    if (!normalizedName) return;

    setIsMutating(true);
    setActiveMutationAction("delete");
    setActiveMutationFileName(normalizedName);
    setError(null);
    setLastSyncMessage(null);

    try {
      const nextAssets = await invoke<SharedAssetSnapshot[]>("shared_assets_delete", {
        fileName: normalizedName,
      });
      setAssets(sortSharedAssets(nextAssets));
      setLastSyncMessage(`Removed ${normalizedName} from Shared Files.`);
    } catch (nextError) {
      setError(toErrorMessage(nextError));
    } finally {
      setActiveMutationFileName(null);
      setActiveMutationAction(null);
      setIsMutating(false);
    }
  });

  const handleDragDropEvent = useEffectEvent((payload: DragDropEvent) => {
    if (payload.type === "enter") {
      setDraggedPaths(payload.paths);
      setError(null);
      return;
    }

    if (payload.type === "leave") {
      setDraggedPaths([]);
      return;
    }

    if (payload.type === "drop") {
      setDraggedPaths([]);
      void importPaths(payload.paths);
    }
  });

  useEffect(() => {
    void refreshAssets();
  }, [hasRuntime]);

  useEffect(() => {
    if (!hasRuntime) return;

    let disposed = false;
    let unlisten: (() => void) | null = null;

    void getCurrentWebviewWindow()
      .onDragDropEvent((event) => {
        if (disposed) return;
        handleDragDropEvent(event.payload);
      })
      .then((cleanup) => {
        if (disposed) {
          cleanup();
          return;
        }
        unlisten = cleanup;
      })
      .catch((nextError) => {
        if (!disposed) {
          setError(toErrorMessage(nextError));
        }
      });

    return () => {
      disposed = true;
      try {
        unlisten?.();
      } catch {
        // Ignore teardown races when the webview listener is already gone.
      }
    };
  }, [hasRuntime]);

  const isDragActive = draggedPaths.length > 0;
  const pathSummary = formatPathSummary(draggedPaths);
  const statusLabel = isImporting
    ? `Syncing ${activeImportCount}`
    : isMutating
      ? activeMutationAction === "delete"
        ? "Removing"
        : "Renaming"
    : isLoading
      ? "Loading"
      : isDragActive
        ? `Release ${draggedPaths.length}`
        : hasRuntime
          ? "Ready"
          : "Desktop only";
  const importStateLabel = isImporting
    ? "Syncing now"
    : isMutating
      ? activeMutationAction === "delete"
        ? "Removing file"
        : "Renaming file"
    : isLoading
      ? "Reading library"
      : isDragActive
        ? "Awaiting release"
        : "Standing by";
  const detailMessage =
    pathSummary ??
    lastSyncMessage ??
    "Drop files from Finder. Weekend copies them into Shared Files and pushes them into every project.";
  const recentAssets = assets.slice(0, 4);
  const emptyStateMessage = isLoading
    ? "Loading shared files..."
    : "Drop something here to make it available across projects.";
  const isBusy = isLoading || isImporting || isMutating;

  const startRename = (fileName: string) => {
    if (isBusy) return;
    setRenamingFileName(fileName);
    setRenameDraft(fileName);
    setError(null);
  };

  const cancelRename = () => {
    setRenamingFileName(null);
    setRenameDraft("");
  };

  const submitRename = (fileName: string) => {
    const trimmed = renameDraft.trim();
    if (!trimmed || trimmed === fileName) {
      cancelRename();
      return;
    }
    if (trimmed.includes("/") || trimmed.includes("\\")) {
      setError("Shared file names cannot include '/' or '\\'.");
      return;
    }

    void renameAsset(fileName, trimmed)
      .then(() => {
        cancelRename();
      })
      .catch(() => undefined);
  };

  const requestDelete = (fileName: string) => {
    if (isBusy) return;
    const confirmed = window.confirm(
      `Remove "${fileName}" from Shared Files and every project copy?`
    );
    if (!confirmed) return;
    void deleteAsset(fileName);
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-transparent p-3 text-foreground">
      <div className="pointer-events-none absolute inset-4 rounded-[36px] bg-[radial-gradient(circle_at_20%_0%,rgba(64,170,140,0.22),transparent_32%),radial-gradient(circle_at_100%_12%,rgba(90,120,200,0.12),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.06),transparent_34%)] blur-2xl opacity-75" />
      <section
        className={cn(
          "relative flex h-full min-h-0 flex-col overflow-hidden rounded-[30px] px-4 pb-4 pt-3 shadow-[0_26px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl",
          isDragActive
            ? "bg-[linear-gradient(180deg,rgba(10,24,20,0.94),rgba(3,6,5,0.96))]"
            : "bg-[linear-gradient(180deg,rgba(14,14,18,0.92),rgba(4,4,6,0.96))]"
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_24%,transparent)]" />

        <header className="relative flex items-center gap-3" data-tauri-drag-region>
          <div className="min-w-0 flex-1">
            <p className="font-vcr text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">
              Weekend Shared Files
            </p>
            <p className="mt-1 font-code text-[11px] leading-4 text-muted-foreground">
              Drop once. Sync everywhere.
            </p>
          </div>
          <Button
            className="h-8 rounded-full bg-white/7 px-3 font-vcr text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:bg-white/12 hover:text-foreground"
            disabled={isBusy}
            onClick={() => {
              void refreshAssets();
            }}
            size="sm"
            soundCue="none"
            variant="ghost"
          >
            {isLoading ? (
              <Spinner className="text-muted-foreground" size="xs" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Refresh
          </Button>
        </header>

        <section
          className={cn(
            "relative mt-3 overflow-hidden rounded-[24px] px-4 py-4 transition-all duration-200",
            isDragActive
              ? "bg-[linear-gradient(180deg,rgba(12,34,28,0.86),rgba(7,17,15,0.9))] shadow-[0_18px_60px_rgba(0,0,0,0.28)]"
              : "bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]"
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-[18px] bg-black/20 shadow-inner",
                isDragActive
                  ? "text-[#7AF0C7]"
                  : "text-[#9fb4ff]"
              )}
            >
              {isImporting ? <Spinner size="sm" /> : <ArrowDownToLine className="size-5" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-code text-[15px] leading-none text-foreground">
                  {isDragActive ? "Release to share" : "Drop files here"}
                </h1>
                <Badge
                  className="rounded-full bg-white/8 px-2.5 py-1 font-vcr text-[10px] uppercase tracking-[0.14em] text-foreground"
                  variant={isDragActive ? "success" : "secondary"}
                >
                  {statusLabel}
                </Badge>
              </div>
              <p className="mt-2 max-w-[26ch] font-code text-[11px] leading-5 text-muted-foreground">
                {detailMessage}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 font-code text-[11px] text-muted-foreground">
            <div className="rounded-full bg-black/25 px-3 py-1.5 text-foreground">
              {assets.length} shared file{assets.length === 1 ? "" : "s"}
            </div>
            <div className="rounded-full bg-white/6 px-3 py-1.5">
              {importStateLabel}
            </div>
          </div>
        </section>

        {error ? (
          <div className="relative mt-3 flex items-start gap-2 rounded-[20px] bg-destructive/12 px-3 py-2.5 text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-vcr text-[10px] uppercase tracking-[0.14em]">
                Shared Files Error
              </p>
              <p className="mt-1 font-code text-[11px] leading-5">{error}</p>
            </div>
          </div>
        ) : null}

        <section className="relative mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] bg-black/22 px-3 py-3">
          {assets.length === 0 ? (
            <div className="flex h-full min-h-[92px] items-center justify-center px-6 text-center">
              <div className="flex items-center gap-2 font-code text-[11px] text-muted-foreground">
                {isLoading ? <Spinner size="xs" /> : <Files className="size-4" />}
                {emptyStateMessage}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-3 px-1">
                <p className="font-vcr text-[10px] uppercase tracking-[0.16em] text-muted-foreground/75">
                  Recent
                </p>
                <span className="font-code text-[10px] text-muted-foreground">
                  {assets.length} total
                </span>
              </div>
              <ul className="min-h-0 flex-1 space-y-2 overflow-auto">
                {recentAssets.map((asset) => (
                  <li
                    className="flex items-center justify-between gap-3 rounded-[16px] bg-white/[0.03] px-3 py-2.5"
                    key={asset.fileName}
                  >
                    <div className="min-w-0">
                      {renamingFileName === asset.fileName ? (
                        <div className="space-y-2">
                          <Input
                            autoFocus
                            className="h-7 bg-black/25 px-2 font-code text-[11px]"
                            onChange={(event) => {
                              setRenameDraft(event.currentTarget.value);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                submitRename(asset.fileName);
                              } else if (event.key === "Escape") {
                                event.preventDefault();
                                cancelRename();
                              }
                            }}
                            value={renameDraft}
                          />
                          <p className="font-code text-[10px] leading-4 text-muted-foreground">
                            {formatFileSize(asset.sizeBytes)} · {formatTimestamp(asset.modifiedAtUnixMs)}
                          </p>
                        </div>
                      ) : (
                        <>
                          <p className="truncate font-code text-[11px] text-foreground">
                            {asset.fileName}
                          </p>
                          <p className="mt-1 font-code text-[10px] leading-4 text-muted-foreground">
                            {formatFileSize(asset.sizeBytes)} · {formatTimestamp(asset.modifiedAtUnixMs)}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {renamingFileName === asset.fileName ? (
                        <>
                          <Button
                            className="h-6 px-2 font-code text-[10px]"
                            disabled={isBusy}
                            onClick={() => {
                              submitRename(asset.fileName);
                            }}
                            size="sm"
                            soundCue="none"
                            variant="ghost"
                          >
                            Save
                          </Button>
                          <Button
                            className="h-6 px-2 font-code text-[10px]"
                            disabled={isBusy}
                            onClick={cancelRename}
                            size="sm"
                            soundCue="none"
                            variant="ghost"
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            className="h-6 px-2 font-code text-[10px]"
                            disabled={isBusy}
                            onClick={() => {
                              startRename(asset.fileName);
                            }}
                            size="sm"
                            soundCue="none"
                            variant="ghost"
                          >
                            {isMutating &&
                            activeMutationAction === "rename" &&
                            activeMutationFileName === asset.fileName
                              ? "..."
                              : "Rename"}
                          </Button>
                          <Button
                            className="h-6 px-2 font-code text-[10px] text-destructive hover:text-destructive"
                            disabled={isBusy}
                            onClick={() => {
                              requestDelete(asset.fileName);
                            }}
                            size="sm"
                            soundCue="none"
                            variant="ghost"
                          >
                            {isMutating &&
                            activeMutationAction === "delete" &&
                            activeMutationFileName === asset.fileName
                              ? "..."
                              : "Remove"}
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {assets.length > recentAssets.length ? (
                <div className="mt-2 px-1 font-code text-[10px] leading-4 text-muted-foreground">
                  +{assets.length - recentAssets.length} more in Shared Files
                </div>
              ) : null}
            </>
          )}
        </section>
      </section>
    </div>
  );
}

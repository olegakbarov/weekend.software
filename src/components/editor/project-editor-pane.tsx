import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  GitCommit,
  Save,
} from "lucide-react";
import { IconButton } from "@weekend/design";
import {
  DiffAnchors,
  DiffStack,
  SplitDiffViewer,
  diffsThemedTokens,
  type DiffStackHandle,
} from "@weekend/design/registry";
import { Button } from "@/components/ui/button";
import {
  ProjectFileTree,
  type DroppedTreeFile,
  type ProjectFileTreeHandle,
} from "@/components/editor/project-file-tree";
import { type VimMode } from "@/components/editor/code-editor";
import {
  pickRenderer,
  type RendererPayload,
} from "@/components/editor/renderers";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useTheme } from "@/components/theme/theme-provider";
import {
  useChangedFiles,
  type ChangedFile,
} from "@/hooks/use-changed-files";
import { diffsWorkerFactory } from "@/lib/diffs-worker-factory";
import type { ProjectTreeNode } from "@/lib/controller";

const VIM_MODE_LABELS: Record<string, string> = {
  normal: "NORMAL",
  insert: "INSERT",
  visual: "VISUAL",
  replace: "REPLACE",
};

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
};

type ProjectBinaryPayload = {
  dataBase64: string;
  sizeBytes: number;
};

type DroppedExternalFile = File & {
  path?: string;
};

type ProjectFileImportPayload = {
  fileName: string;
  sourcePath?: string;
  dataBase64?: string;
};

function toImageMimeType(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_MIME_BY_EXTENSION[ext] ?? null;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error(`failed to read "${file.name}"`));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error(`failed to read "${file.name}"`));
    };
    reader.readAsDataURL(file);
  });
}

function extractDroppedFilePath(file: File): string | null {
  const candidate = (file as DroppedExternalFile).path;
  if (typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function vimModeColor(mode: VimMode): string {
  switch (mode) {
    case "insert":
      return "text-green-500 dark:text-green-400";
    case "visual":
      return "text-blue-500 dark:text-blue-400";
    case "replace":
      return "text-red-500 dark:text-red-400";
    default:
      return "text-amber-500 dark:text-amber-400";
  }
}

function isPathAtOrBelow(path: string | null, basePath: string): boolean {
  if (!path) return false;
  return path === basePath || path.startsWith(`${basePath}/`);
}

function remapPathAfterRename(
  path: string | null,
  oldBasePath: string,
  newBasePath: string
): string | null {
  if (!path) return null;
  if (path === oldBasePath) return newBasePath;
  const oldPrefix = `${oldBasePath}/`;
  if (!path.startsWith(oldPrefix)) return path;
  return `${newBasePath}/${path.slice(oldPrefix.length)}`;
}

type RightPaneTab = "files" | "diffs";

export function ProjectEditorPane({
  project,
  projectTree,
  filesystemEventVersion,
  requestedFilePath,
  onSelectedFilePathChange,
  onProjectTreeMutated,
  onCommitChanges,
  isVimModeEnabled,
  onVimModeEnabledChange,
}: {
  project: string;
  projectTree: ProjectTreeNode[];
  filesystemEventVersion: number;
  requestedFilePath: string | null;
  onSelectedFilePathChange: (path: string | null) => void;
  onProjectTreeMutated?: (project: string) => Promise<void>;
  onCommitChanges?: (changedFilePaths: readonly string[]) => void;
  isVimModeEnabled: boolean;
  onVimModeEnabledChange?: (enabled: boolean) => void;
}) {
  const [rightPaneTab, setRightPaneTab] = useState<RightPaneTab>("diffs");
  const { isDark } = useTheme();
  const themeType = isDark ? "dark" : "light";
  const {
    files: changedFiles,
    isLoading: isLoadingChangedFiles,
    error: changedFilesError,
  } = useChangedFiles(project, filesystemEventVersion, {
    withDiffs: rightPaneTab === "diffs",
  });
  const [activeDiffPath, setActiveDiffPath] = useState<string | null>(null);
  const diffStackRef = useRef<DiffStackHandle>(null);

  // Per-file collapse overrides for the diff stack. Path → true means user
  // manually collapsed; false means user manually expanded; missing means use
  // the size-based default (large diffs collapse, small ones expand). Keeping
  // overrides separate from "is this path currently collapsed" lets us keep
  // the user's manual choice stable when changedFiles re-fetches.
  const [diffCollapseOverrides, setDiffCollapseOverrides] = useState<
    ReadonlyMap<string, boolean>
  >(() => new Map());

  // Mirror current changed-file paths into a ref so the bulk handlers stay
  // identity-stable; they only need the latest snapshot at click time.
  const changedFilesPathsRef = useRef<readonly string[]>([]);
  useEffect(() => {
    changedFilesPathsRef.current = changedFiles.map((file) => file.path);
  }, [changedFiles]);

  const handleToggleDiffCollapse = useCallback(
    (path: string, defaultCollapsed: boolean) => {
      setDiffCollapseOverrides((prev) => {
        const next = new Map(prev);
        const current = next.has(path) ? next.get(path) : defaultCollapsed;
        next.set(path, !current);
        return next;
      });
    },
    [],
  );

  const handleCollapseAllDiffs = useCallback(() => {
    setDiffCollapseOverrides(
      new Map(changedFilesPathsRef.current.map((p) => [p, true])),
    );
  }, []);

  const handleExpandAllDiffs = useCallback(() => {
    setDiffCollapseOverrides(
      new Map(changedFilesPathsRef.current.map((p) => [p, false])),
    );
  }, []);

  // Reset active diff anchor when the changed-file set shrinks or changes
  // shape (path no longer present) so the anchor list doesn't keep a stale
  // highlight after a file gets staged or reverted externally.
  useEffect(() => {
    if (!activeDiffPath) return;
    const stillPresent = changedFiles.some((file) => file.path === activeDiffPath);
    if (!stillPresent) {
      setActiveDiffPath(changedFiles[0]?.path ?? null);
    }
  }, [changedFiles, activeDiffPath]);

  const handleAnchorClick = useCallback((path: string) => {
    setActiveDiffPath(path);
    diffStackRef.current?.scrollToFile(path);
  }, []);

  const changedFilePaths = useMemo(
    () => changedFiles.map((file) => file.path),
    [changedFiles],
  );
  const canCommitChanges = Boolean(onCommitChanges) && changedFilePaths.length > 0;
  const handleCommitChanges = useCallback(() => {
    if (!onCommitChanges || changedFilePaths.length === 0) return;
    onCommitChanges(changedFilePaths);
  }, [changedFilePaths, onCommitChanges]);

  const isDiffsTab = rightPaneTab === "diffs";
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [payload, setPayload] = useState<RendererPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMutatingTree, setIsMutatingTree] = useState(false);
  const [vimMode, setVimMode] = useState<VimMode>("insert");
  const [vimSubMode, setVimSubMode] = useState<string | undefined>(undefined);

  const saveTimerRef = useRef<number | null>(null);
  const pendingContentRef = useRef<string | null>(null);
  const currentPathRef = useRef<string | null>(null);
  const fileTreeRef = useRef<ProjectFileTreeHandle>(null);

  // Reset vim mode when vim is toggled or file changes
  useEffect(() => {
    setVimMode("insert");
    setVimSubMode(undefined);
  }, [isVimModeEnabled, selectedFilePath]);

  const flushSave = useCallback(async () => {
    const path = currentPathRef.current;
    const content = pendingContentRef.current;
    if (!path || content === null) return;
    pendingContentRef.current = null;

    setIsSaving(true);
    try {
      await invoke("write_project_file", { project, path, content });
    } catch (error) {
      console.error("[ProjectEditor] save failed", error);
    } finally {
      setIsSaving(false);
    }
  }, [project]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      onSelectedFilePathChange(null);
    };
  }, [onSelectedFilePathChange]);

  const handleSelectFile = useCallback(
    async (path: string) => {
      // Flush pending save for previous file
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      await flushSave();

      setSelectedFilePath(path);
      onSelectedFilePathChange(path);
      currentPathRef.current = path;
      setPayload(null);
      setLoadError(null);
      setIsLoading(true);

      try {
        const renderer = pickRenderer(path);
        if (renderer.payloadKind === "image") {
          const mimeType = toImageMimeType(path) ?? "application/octet-stream";
          const result = await invoke<ProjectBinaryPayload>(
            "read_project_file_binary",
            { project, path }
          );
          setPayload({
            kind: "image",
            mimeType,
            dataUrl: `data:${mimeType};base64,${result.dataBase64}`,
            sizeBytes: result.sizeBytes,
          });
        } else {
          const content = await invoke<string>("read_project_file", {
            project,
            path,
          });
          setPayload({ kind: "text", content });
        }
      } catch (error) {
        setLoadError(
          error instanceof Error ? error.message : String(error)
        );
      } finally {
        setIsLoading(false);
      }
    },
    [flushSave, onSelectedFilePathChange, project]
  );

  const handleContentChange = useCallback(
    (content: string) => {
      pendingContentRef.current = content;

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        void flushSave();
      }, 1000);
    },
    [flushSave]
  );

  const handleSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    void flushSave();
  }, [flushSave]);

  const handleRenamePath = useCallback(
    async (path: string, newName: string) => {
      setIsMutatingTree(true);
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      await flushSave();

      try {
        const renamedPath = await invoke<string>("rename_project_path", {
          project,
          path,
          newName,
        });

        const nextSelectedPath = remapPathAfterRename(
          selectedFilePath,
          path,
          renamedPath
        );
        if (nextSelectedPath !== selectedFilePath) {
          setSelectedFilePath(nextSelectedPath);
          onSelectedFilePathChange(nextSelectedPath);
          currentPathRef.current = nextSelectedPath;
        }
        // Image payloads carry no path themselves; selectedFilePath above is
        // already remapped, so the next render passes the new filePath into
        // the renderer. No payload mutation needed.
        if (onProjectTreeMutated) {
          await onProjectTreeMutated(project).catch((error) => {
            console.error("[ProjectEditor] refresh tree after rename failed", error);
          });
        }
      } catch (error) {
        console.error("[ProjectEditor] rename path failed", error);
        throw error;
      } finally {
        setIsMutatingTree(false);
      }
    },
    [
      flushSave,
      onProjectTreeMutated,
      onSelectedFilePathChange,
      project,
      selectedFilePath,
    ]
  );

  const handleDeletePath = useCallback(
    async (path: string) => {
      setIsMutatingTree(true);
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      await flushSave();

      try {
        await invoke("delete_project_path", { project, path });
        if (isPathAtOrBelow(selectedFilePath, path)) {
          setSelectedFilePath(null);
          onSelectedFilePathChange(null);
          currentPathRef.current = null;
          pendingContentRef.current = null;
          setPayload(null);
          setLoadError(null);
        }
        if (onProjectTreeMutated) {
          await onProjectTreeMutated(project).catch((error) => {
            console.error("[ProjectEditor] refresh tree after delete failed", error);
          });
        }
      } catch (error) {
        console.error("[ProjectEditor] delete path failed", error);
        throw error;
      } finally {
        setIsMutatingTree(false);
      }
    },
    [
      flushSave,
      onProjectTreeMutated,
      onSelectedFilePathChange,
      project,
      selectedFilePath,
    ]
  );

  const handleVimModeChange = useCallback(
    (mode: VimMode, subMode?: string) => {
      setVimMode(mode);
      setVimSubMode(subMode);
    },
    []
  );

  const handleDropFiles = useCallback(
    async (targetDirPath: string | null, files: DroppedTreeFile[]) => {
      const selectedFiles = files.filter(
        (item) => item.file.name.trim().length > 0
      );
      if (selectedFiles.length === 0) return;

      setIsMutatingTree(true);
      try {
        const payload: ProjectFileImportPayload[] = await Promise.all(
          selectedFiles.map(async (item) => {
            const sourcePath = item.sourcePath ?? extractDroppedFilePath(item.file);
            if (sourcePath) {
              return {
                fileName: item.file.name,
                sourcePath,
              };
            }
            return {
              fileName: item.file.name,
              dataBase64: await readFileAsDataUrl(item.file),
            };
          })
        );

        const importedPaths = await invoke<string[]>(
          "import_external_files_to_project",
          {
            project,
            targetDir: targetDirPath,
            files: payload,
          }
        );

        if (onProjectTreeMutated) {
          await onProjectTreeMutated(project).catch((error) => {
            console.error("[ProjectEditor] refresh tree after drop failed", error);
          });
        }

        const firstImportedPath = importedPaths[0];
        if (firstImportedPath) {
          await handleSelectFile(firstImportedPath);
        }
      } catch (error) {
        console.error("[ProjectEditor] drop import failed", error);
        throw error;
      } finally {
        setIsMutatingTree(false);
      }
    },
    [handleSelectFile, onProjectTreeMutated, project]
  );

  useEffect(() => {
    if (!requestedFilePath) return;
    // External file-open requests should reveal the editor — flip out of the
    // diffs tab so the file tree + editor are mounted alongside the load.
    setRightPaneTab("files");
    if (requestedFilePath === selectedFilePath) return;
    void handleSelectFile(requestedFilePath);
  }, [handleSelectFile, requestedFilePath, selectedFilePath]);

  const vimModeLabel =
    vimMode === "visual" && vimSubMode === "linewise"
      ? "V-LINE"
      : vimMode === "visual" && vimSubMode === "blockwise"
        ? "V-BLOCK"
        : (VIM_MODE_LABELS[vimMode] ?? vimMode.toUpperCase());
  const activeRenderer = selectedFilePath ? pickRenderer(selectedFilePath) : null;
  const isReadOnlyView = activeRenderer ? !activeRenderer.editable : false;

  return (
    <div className="flex h-full w-full min-h-0 min-w-0">
      <ResizablePanelGroup className="h-full w-full" direction="horizontal">
        <ResizablePanel
          className="flex min-w-0 flex-1 flex-col"
          defaultSize="74%"
          minSize="45%"
        >
          <div className="min-h-0 flex-1 overflow-hidden">
            {isDiffsTab ? (
              <DiffsLeftPane
                changedFiles={changedFiles}
                isLoading={isLoadingChangedFiles}
                error={changedFilesError}
                themeType={themeType}
                onActiveFileChange={setActiveDiffPath}
                stackRef={diffStackRef}
                collapseOverrides={diffCollapseOverrides}
                onToggleCollapse={handleToggleDiffCollapse}
              />
            ) : isLoading ? (
              <div className="flex h-full items-center justify-center">
                <p className="font-code text-xs text-muted-foreground">
                  Loading...
                </p>
              </div>
            ) : loadError ? (
              <div className="flex h-full items-center justify-center px-4">
                <p className="font-code text-xs text-foreground">
                  {loadError}
                </p>
              </div>
            ) : payload && selectedFilePath && activeRenderer ? (
              <activeRenderer.Component
                filePath={selectedFilePath}
                isVimModeEnabled={isVimModeEnabled}
                onChange={handleContentChange}
                onSave={handleSave}
                onVimModeChange={handleVimModeChange}
                payload={payload}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="font-code text-sm text-muted-foreground/40">
                  Select a file to edit
                </p>
              </div>
            )}
          </div>

          {/* Editor status bar — only meaningful when an editor is mounted. */}
          {!isDiffsTab && (
            <div className="flex h-9 items-center justify-between border-t border-border/70 px-2">
              <span
                className={`min-w-[4.5rem] font-code text-[12px] font-medium ${
                  isVimModeEnabled
                    ? vimModeColor(vimMode)
                    : "text-transparent select-none"
                }`}
              >
                {isVimModeEnabled ? vimModeLabel : "——"}
              </span>

              <div className="flex min-w-0 items-center gap-1">
                {/* Vim / Normal mode toggle */}
                {onVimModeEnabledChange && (
                  <div className="flex gap-0.5">
                    {(["normal", "vim"] as const).map((m) => {
                      const active =
                        m === "vim" ? isVimModeEnabled : !isVimModeEnabled;
                      return (
                        <button
                          key={m}
                          onClick={() =>
                            onVimModeEnabledChange(m === "vim")
                          }
                          className={`rounded px-1.5 py-0.5 font-vcr text-[11px] leading-none tracking-wide uppercase transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          }`}
                        >
                          {m.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                )}
                <Button
                  disabled={!selectedFilePath || isSaving || isReadOnlyView}
                  icon={Save}
                  onClick={handleSave}
                  size="xs"
                  variant="ghost"
                  className="font-vcr text-[10px] tracking-[0.12em] uppercase"
                >
                  {isSaving
                    ? "SAVING..."
                    : isReadOnlyView
                      ? (activeRenderer?.name ?? "VIEW").toUpperCase()
                      : "SAVE"}
                </Button>
              </div>
            </div>
          )}
        </ResizablePanel>

        <ResizableHandle className="bg-border/70 after:w-2 hover:bg-border data-[dragging]:bg-border" />

        <ResizablePanel
          className="flex min-w-0 flex-col bg-background"
          defaultSize="26%"
          maxSize="45%"
          minSize={180}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <div
              aria-label="Right sidebar views"
              className="grid h-10 shrink-0 grid-cols-2"
              role="tablist"
            >
              <button
                aria-controls="right-pane-panel-diffs"
                aria-selected={rightPaneTab === "diffs"}
                aria-label={changedFiles.length > 0 ? "Diffs with changes" : "Diffs"}
                className={`flex min-w-0 items-center justify-center border-r border-b border-border/70 px-2 font-vcr text-[10px] leading-none tracking-[0.16em] uppercase transition-colors ${
                  rightPaneTab === "diffs"
                    ? "border-b-foreground bg-background text-foreground"
                    : "bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
                id="right-pane-tab-diffs"
                onClick={() => setRightPaneTab("diffs")}
                role="tab"
                type="button"
              >
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span className="truncate">DIFFS</span>
                  {changedFiles.length > 0 && (
                    <span
                      aria-hidden="true"
                      className="size-1.5 shrink-0 rounded-full bg-(--color-green)"
                    />
                  )}
                </span>
              </button>
              <button
                aria-controls="right-pane-panel-files"
                aria-selected={rightPaneTab === "files"}
                className={`flex min-w-0 items-center justify-center border-b border-border/70 px-2 font-vcr text-[10px] leading-none tracking-[0.16em] uppercase transition-colors ${
                  rightPaneTab === "files"
                    ? "border-b-foreground bg-background text-foreground"
                    : "bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
                id="right-pane-tab-files"
                onClick={() => setRightPaneTab("files")}
                role="tab"
                type="button"
              >
                <span className="truncate">FILES</span>
              </button>
            </div>

            {rightPaneTab === "diffs" ? (
              <div
                aria-labelledby="right-pane-tab-diffs"
                className="flex min-h-0 flex-1 flex-col"
                id="right-pane-panel-diffs"
                role="tabpanel"
              >
                <div className="min-h-0 flex-1 overflow-hidden">
                  <DiffAnchors
                    activePath={activeDiffPath}
                    files={changedFiles}
                    onSelect={handleAnchorClick}
                    emptyState={
                      changedFilesError
                        ? "Failed to read git status"
                        : isLoadingChangedFiles
                          ? "Loading…"
                          : "No changes"
                    }
                  />
                </div>
                <div className="flex h-9 items-center justify-between border-t border-border/70 px-2">
                  <div className="flex items-center gap-0.5">
                    <IconButton
                      icon={ChevronsUpDown}
                      label="Expand all diffs"
                      size="xs"
                      disabled={changedFiles.length === 0}
                      onClick={handleExpandAllDiffs}
                    />
                    <IconButton
                      icon={ChevronsDownUp}
                      label="Collapse all diffs"
                      size="xs"
                      disabled={changedFiles.length === 0}
                      onClick={handleCollapseAllDiffs}
                    />
                  </div>
                  <CommitChangesButton
                    disabled={!canCommitChanges}
                    onClick={handleCommitChanges}
                  />
                </div>
              </div>
            ) : (
              <div
                aria-labelledby="right-pane-tab-files"
                className="flex min-h-0 flex-1 flex-col"
                id="right-pane-panel-files"
                role="tabpanel"
              >
                <div className="min-h-0 flex-1 overflow-hidden">
                  <MemoizedProjectFileTree
                    fileTreeRef={fileTreeRef}
                    tree={projectTree}
                    selectedPath={selectedFilePath}
                    onSelectFile={handleSelectFile}
                    onRenamePath={handleRenamePath}
                    onDeletePath={handleDeletePath}
                    onDropFiles={handleDropFiles}
                    isMutating={isMutatingTree}
                    storageKey={`weekend.fileTree.expanded.${project}`}
                  />
                </div>
                <div className="flex h-9 items-center justify-between border-t border-border/70 px-2">
                  <div className="flex items-center gap-0.5">
                    <IconButton
                      icon={ChevronsUpDown}
                      label="Expand all folders"
                      size="xs"
                      onClick={() => fileTreeRef.current?.expandAll()}
                    />
                    <IconButton
                      icon={ChevronsDownUp}
                      label="Collapse all folders"
                      size="xs"
                      onClick={() => fileTreeRef.current?.collapseAll()}
                    />
                  </div>
                  <CommitChangesButton
                    disabled={!canCommitChanges}
                    onClick={handleCommitChanges}
                  />
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function CommitChangesButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 font-vcr text-[11px] leading-none tracking-wide uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        disabled
          ? "text-muted-foreground/50"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
      disabled={disabled}
      onClick={onClick}
      title="Commit changes"
      type="button"
    >
      <GitCommit className="size-3 shrink-0" />
      <span>Commit</span>
    </button>
  );
}

interface DiffsLeftPaneProps {
  changedFiles: ChangedFile[];
  isLoading: boolean;
  error: string | null;
  themeType: "light" | "dark";
  onActiveFileChange: (path: string) => void;
  stackRef: React.RefObject<DiffStackHandle | null>;
  collapseOverrides: ReadonlyMap<string, boolean>;
  onToggleCollapse: (path: string, defaultCollapsed: boolean) => void;
}

function DiffsLeftPane({
  changedFiles,
  isLoading,
  error,
  themeType,
  onActiveFileChange,
  stackRef,
  collapseOverrides,
  onToggleCollapse,
}: DiffsLeftPaneProps) {
  const renderItem = useCallback(
    (file: ChangedFile) => (
      <DiffStackEntry
        file={file}
        themeType={themeType}
        override={collapseOverrides.get(file.path)}
        onToggle={onToggleCollapse}
      />
    ),
    [themeType, collapseOverrides, onToggleCollapse]
  );

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <p className="max-w-md text-center font-code text-xs text-foreground">
          {error}
        </p>
      </div>
    );
  }
  if (isLoading && changedFiles.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="font-code text-xs text-muted-foreground">Loading…</p>
      </div>
    );
  }
  return (
    <DiffStack
      files={changedFiles}
      ref={stackRef}
      onActiveFileChange={onActiveFileChange}
      renderItem={renderItem}
      workerFactory={diffsWorkerFactory}
      emptyState={
        <p className="font-code text-sm text-muted-foreground/60">
          No uncommitted changes
        </p>
      }
    />
  );
}

interface DiffStackEntryProps {
  file: ChangedFile;
  themeType: "light" | "dark";
  /** Manual collapse override; when undefined, falls back to the size-based default. */
  override: boolean | undefined;
  onToggle: (path: string, defaultCollapsed: boolean) => void;
}

const LARGE_DIFF_LINE_THRESHOLD = 1000;

// Berkeley Mono inside the diff Shadow DOM. The viewer's default `tokens`
// pin `--diffs-font-family` to ui-monospace; we override it here to inherit
// Weekend's `--font-mono` so the family stays consistent with the file tree.
const DIFF_TOKENS = {
  ...diffsThemedTokens,
  "--diffs-font-family": "var(--font-mono)",
} as CSSProperties;

/**
 * Count "lines" in a unified-diff patch for the purposes of deciding whether
 * to collapse the diff by default. The threshold is `LARGE_DIFF_LINE_THRESHOLD`.
 *
 * Count rendered hunk rows, not file metadata. Context rows still cost renderer
 * work in unified mode, so they should contribute to the collapse threshold.
 */
function countDiffLines(patch: string): number {
  if (!patch.trim()) return 0;

  let count = 0;
  let inHunk = false;
  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) {
      inHunk = false;
      continue;
    }
    if (line.startsWith("@@")) {
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith("\\ No newline")) continue;
    if (line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) {
      count += 1;
    }
  }

  return count;
}

const DiffStackEntry = memo(function DiffStackEntry({
  file,
  themeType,
  override,
  onToggle,
}: DiffStackEntryProps) {
  const patch = file.diff ?? "";
  const lineCount = useMemo(() => countDiffLines(patch), [patch]);
  const defaultCollapsed = lineCount > LARGE_DIFF_LINE_THRESHOLD;
  const isCollapsed = override ?? defaultCollapsed;

  const handleToggle = useCallback(() => {
    onToggle(file.path, defaultCollapsed);
  }, [defaultCollapsed, file.path, onToggle]);

  const Chevron = isCollapsed ? ChevronRight : ChevronDown;
  const header = (
    <button
      type="button"
      onClick={handleToggle}
      className="flex w-full items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 font-mono text-xs text-left cursor-pointer hover:bg-muted/60 transition-colors"
      aria-expanded={!isCollapsed}
      aria-label={isCollapsed ? `Expand diff for ${file.path}` : `Collapse diff for ${file.path}`}
    >
      <Chevron className="size-3 shrink-0 text-muted-foreground" strokeWidth={2} />
      <span
        className={`w-3 text-center font-bold ${
          file.status === "A" || file.status === "U"
            ? "text-(--color-green)"
            : file.status === "D"
              ? "text-(--color-red)"
              : file.status === "R"
                ? "text-(--color-blue)"
                : "text-(--color-amber)"
        }`}
      >
        {file.status}
      </span>
      <span className="truncate flex-1">{file.path}</span>
      {defaultCollapsed && isCollapsed && (
        <span className="shrink-0 text-muted-foreground">
          {lineCount.toLocaleString()} lines
        </span>
      )}
    </button>
  );

  if (isCollapsed) {
    return (
      <div className="overflow-hidden rounded border border-border">
        {header}
      </div>
    );
  }

  return (
    <SplitDiffViewer
      header={header}
      patch={patch}
      path={file.path}
      themeType={themeType}
      tokens={DIFF_TOKENS}
    />
  );
});

interface MemoizedProjectFileTreeProps {
  fileTreeRef: React.Ref<ProjectFileTreeHandle>;
  tree: ProjectTreeNode[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onRenamePath: (path: string, newName: string) => Promise<void>;
  onDeletePath: (path: string) => Promise<void>;
  onDropFiles: (
    targetDirPath: string | null,
    files: DroppedTreeFile[]
  ) => Promise<void>;
  isMutating: boolean;
  storageKey: string;
}

const MemoizedProjectFileTree = memo(function MemoizedProjectFileTree({
  fileTreeRef,
  tree,
  selectedPath,
  onSelectFile,
  onRenamePath,
  onDeletePath,
  onDropFiles,
  isMutating,
  storageKey,
}: MemoizedProjectFileTreeProps) {
  return (
    <ProjectFileTree
      ref={fileTreeRef}
      tree={tree}
      selectedPath={selectedPath}
      onSelectFile={onSelectFile}
      onRenamePath={onRenamePath}
      onDeletePath={onDeletePath}
      onDropFiles={onDropFiles}
      isMutating={isMutating}
      storageKey={storageKey}
    />
  );
});

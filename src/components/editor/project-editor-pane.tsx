import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ProjectFileTree,
  type DroppedTreeFile,
} from "@/components/editor/project-file-tree";
import { CodeEditor, type VimMode } from "@/components/editor/code-editor";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import type { ProjectTreeNode } from "@/lib/workspace-controller";

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

type ImagePreviewState = {
  path: string;
  mimeType: string;
  dataUrl: string;
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

export function ProjectEditorPane({
  project,
  projectTree,
  requestedFilePath,
  onSelectedFilePathChange,
  onProjectTreeMutated,
  isVimModeEnabled,
  onVimModeEnabledChange,
}: {
  project: string;
  projectTree: ProjectTreeNode[];
  requestedFilePath: string | null;
  onSelectedFilePathChange: (path: string | null) => void;
  onProjectTreeMutated?: (project: string) => Promise<void>;
  isVimModeEnabled: boolean;
  onVimModeEnabledChange?: (enabled: boolean) => void;
}) {
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<ImagePreviewState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMutatingTree, setIsMutatingTree] = useState(false);
  const [vimMode, setVimMode] = useState<VimMode>("insert");
  const [vimSubMode, setVimSubMode] = useState<string | undefined>(undefined);

  const saveTimerRef = useRef<number | null>(null);
  const pendingContentRef = useRef<string | null>(null);
  const currentPathRef = useRef<string | null>(null);

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
      setFileContent(null);
      setImagePreview(null);
      setLoadError(null);
      setIsLoading(true);

      try {
        const imageMimeType = toImageMimeType(path);
        if (imageMimeType) {
          const payload = await invoke<ProjectBinaryPayload>(
            "read_project_file_binary",
            { project, path }
          );
          setImagePreview({
            path,
            mimeType: imageMimeType,
            dataUrl: `data:${imageMimeType};base64,${payload.dataBase64}`,
            sizeBytes: payload.sizeBytes,
          });
        } else {
          const content = await invoke<string>("read_project_file", {
            project,
            path,
          });
          setFileContent(content);
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
        setImagePreview((prev) => {
          if (!prev) return prev;
          const remappedPath = remapPathAfterRename(prev.path, path, renamedPath);
          return remappedPath ? { ...prev, path: remappedPath } : prev;
        });
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
          setFileContent(null);
          setImagePreview(null);
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
    if (requestedFilePath === selectedFilePath) return;
    void handleSelectFile(requestedFilePath);
  }, [handleSelectFile, requestedFilePath, selectedFilePath]);

  const vimModeLabel =
    vimMode === "visual" && vimSubMode === "linewise"
      ? "V-LINE"
      : vimMode === "visual" && vimSubMode === "blockwise"
        ? "V-BLOCK"
        : (VIM_MODE_LABELS[vimMode] ?? vimMode.toUpperCase());
  const isImageSelected =
    imagePreview !== null &&
    selectedFilePath !== null &&
    imagePreview.path === selectedFilePath;
  const previewSizeLabel = isImageSelected
    ? new Intl.NumberFormat("en-US").format(imagePreview.sizeBytes)
    : null;

  return (
    <div className="flex h-full w-full min-h-0 min-w-0">
      <ResizablePanelGroup className="h-full w-full" direction="horizontal">
        <ResizablePanel
          className="flex min-w-0 flex-1 flex-col"
          defaultSize="74%"
          minSize="45%"
        >
          <div className="min-h-0 flex-1 overflow-hidden">
            {isLoading ? (
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
            ) : isImageSelected && imagePreview ? (
              <div className="flex h-full min-h-0 flex-col">
                <div className="border-b border-border/70 px-3 py-2">
                  <p
                    className="truncate font-code text-xs text-muted-foreground"
                    title={imagePreview.path}
                  >
                    {imagePreview.path}
                    {previewSizeLabel ? ` • ${previewSizeLabel} bytes` : ""}
                  </p>
                </div>
                <div className="flex min-h-0 flex-1 items-center justify-center p-4">
                  <img
                    alt={selectedFilePath}
                    className="max-h-full max-w-full rounded border border-border/60 bg-background object-contain shadow-sm"
                    src={imagePreview.dataUrl}
                  />
                </div>
              </div>
            ) : fileContent !== null && selectedFilePath ? (
              <CodeEditor
                content={fileContent}
                filePath={selectedFilePath}
                isVimModeEnabled={isVimModeEnabled}
                onChange={handleContentChange}
                onSave={handleSave}
                onVimModeChange={handleVimModeChange}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="font-code text-sm text-muted-foreground/40">
                  Select a file to edit
                </p>
              </div>
            )}
          </div>

          {/* Editor status bar */}
          <div className="flex h-6 items-center justify-between border-t border-border/70 px-2">
            <span
              className={`min-w-[4.5rem] font-code text-[12px] font-medium ${
                isVimModeEnabled
                  ? vimModeColor(vimMode)
                  : "text-transparent select-none"
              }`}
            >
              {isVimModeEnabled ? vimModeLabel : "——"}
            </span>

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
                      className={`rounded px-1.5 py-0.5 font-code text-[12px] transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle className="bg-border/70 after:w-2 hover:bg-border data-[dragging]:bg-border" />

        <ResizablePanel
          className="flex min-w-0 flex-col bg-background"
          defaultSize="26%"
          maxSize="45%"
          minSize={180}
        >
          <div className="min-h-0 flex-1 overflow-hidden">
            <ProjectFileTree
              tree={projectTree}
              selectedPath={selectedFilePath}
              onSelectFile={handleSelectFile}
              onRenamePath={handleRenamePath}
              onDeletePath={handleDeletePath}
              onDropFiles={handleDropFiles}
              isMutating={isMutatingTree}
            />
          </div>
          <div className="space-y-1 border-border border-t p-2">
            <Button
              className="w-full justify-start"
              disabled={!selectedFilePath || isSaving || isImageSelected}
              onClick={handleSave}
              size="sm"
              variant="ghost"
            >
              <Save className="mr-1.5 size-3" />
              {isSaving ? "Saving..." : isImageSelected ? "Image Preview" : "Save"}
            </Button>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

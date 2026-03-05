import { useCallback, useState, type DragEvent } from "react";
import {
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import type { ProjectTreeNode } from "@/lib/controller";

const ROOT_DROP_TARGET_KEY = "__ROOT__";

export type DroppedTreeFile = {
  file: File;
  sourcePath: string | null;
};

function toDropTargetKey(path: string | null): string {
  return path ?? ROOT_DROP_TARGET_KEY;
}

function toParentDirPath(path: string): string | null {
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash < 0) return null;
  return path.slice(0, lastSlash) || null;
}

function hasFilePayload(event: DragEvent<HTMLElement>): boolean {
  if (event.dataTransfer.files.length > 0) return true;
  return Array.from(event.dataTransfer.types).includes("Files");
}

function decodeFileUriPath(rawUri: string): string | null {
  const trimmed = rawUri.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  try {
    const uri = new URL(trimmed);
    if (uri.protocol !== "file:") return null;
    const decoded = decodeURIComponent(uri.pathname);
    if (!decoded) return null;
    // Windows file URI paths are encoded as /C:/path...
    if (/^\/[a-zA-Z]:\//.test(decoded)) {
      return decoded.slice(1);
    }
    return decoded;
  } catch {
    return null;
  }
}

function fileNameFromPath(path: string): string | null {
  const normalized = path.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  return last ? last : null;
}

function extractDroppedSourcePaths(dataTransfer: DataTransfer): string[] {
  const uriList = dataTransfer.getData("text/uri-list");
  if (!uriList.trim()) return [];
  return uriList
    .split(/\r?\n/)
    .map((line) => decodeFileUriPath(line))
    .filter((path): path is string => path !== null);
}

function toDroppedTreeFiles(dataTransfer: DataTransfer): DroppedTreeFile[] {
  const droppedFiles = Array.from(dataTransfer.files);
  if (droppedFiles.length === 0) return [];

  const sourcePaths = extractDroppedSourcePaths(dataTransfer);
  if (sourcePaths.length === 0) {
    return droppedFiles.map((file) => ({ file, sourcePath: null }));
  }

  const sourcePathsByName = new Map<string, string[]>();
  for (const sourcePath of sourcePaths) {
    const fileName = fileNameFromPath(sourcePath);
    if (!fileName) continue;
    const existing = sourcePathsByName.get(fileName);
    if (existing) {
      existing.push(sourcePath);
      continue;
    }
    sourcePathsByName.set(fileName, [sourcePath]);
  }

  return droppedFiles.map((file, index) => {
    const indexPath =
      sourcePaths.length === droppedFiles.length ? sourcePaths[index] : null;
    if (indexPath) {
      return { file, sourcePath: indexPath };
    }

    const named = sourcePathsByName.get(file.name);
    const matchedPath = named?.shift() ?? null;
    if (named && named.length === 0) {
      sourcePathsByName.delete(file.name);
    }
    return { file, sourcePath: matchedPath };
  });
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

export function ProjectFileTree({
  tree,
  selectedPath,
  onSelectFile,
  onRenamePath,
  onDeletePath,
  onDropFiles,
  isMutating = false,
}: {
  tree: ProjectTreeNode[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onRenamePath: (path: string, newName: string) => Promise<void>;
  onDeletePath: (path: string) => Promise<void>;
  onDropFiles?: (
    targetDirPath: string | null,
    files: DroppedTreeFile[]
  ) => Promise<void>;
  isMutating?: boolean;
}) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  const handleDragOverTarget = useCallback(
    (event: DragEvent<HTMLElement>, targetDirPath: string | null) => {
      if (!onDropFiles || isMutating) return;
      if (!hasFilePayload(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      setDropTargetKey(toDropTargetKey(targetDirPath));
    },
    [isMutating, onDropFiles]
  );

  const handleDropToTarget = useCallback(
    async (event: DragEvent<HTMLElement>, targetDirPath: string | null) => {
      if (!onDropFiles || isMutating) return;
      if (!hasFilePayload(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const droppedFiles = toDroppedTreeFiles(event.dataTransfer);
      setDropTargetKey(null);
      if (droppedFiles.length === 0) return;
      try {
        await onDropFiles(targetDirPath, droppedFiles);
      } catch (error) {
        window.alert(toErrorMessage(error));
      }
    },
    [isMutating, onDropFiles]
  );

  const toggleDir = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  return (
    <div
      className={cn(
        "h-full overflow-y-auto overflow-x-hidden py-1.5 font-code text-[15px] leading-relaxed",
        dropTargetKey === ROOT_DROP_TARGET_KEY && "bg-primary/5"
      )}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }
        setDropTargetKey(null);
      }}
      onDragOver={(event) => handleDragOverTarget(event, null)}
      onDrop={(event) => {
        void handleDropToTarget(event, null);
      }}
    >
      <TreeNodes
        nodes={tree}
        depth={0}
        dropTargetKey={dropTargetKey}
        expandedPaths={expandedPaths}
        isMutating={isMutating}
        onDeletePath={onDeletePath}
        onDragOverTarget={handleDragOverTarget}
        onDropToTarget={handleDropToTarget}
        onRenamePath={onRenamePath}
        onSelectFile={onSelectFile}
        onToggleDir={toggleDir}
        selectedPath={selectedPath}
      />
    </div>
  );
}

function TreeNodes({
  nodes,
  depth,
  dropTargetKey,
  expandedPaths,
  selectedPath,
  onToggleDir,
  onSelectFile,
  onRenamePath,
  onDeletePath,
  onDragOverTarget,
  onDropToTarget,
  isMutating,
}: {
  nodes: ProjectTreeNode[];
  depth: number;
  dropTargetKey: string | null;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  onToggleDir: (path: string) => void;
  onSelectFile: (path: string) => void;
  onRenamePath: (path: string, newName: string) => Promise<void>;
  onDeletePath: (path: string) => Promise<void>;
  onDragOverTarget: (
    event: DragEvent<HTMLElement>,
    targetDirPath: string | null
  ) => void;
  onDropToTarget: (
    event: DragEvent<HTMLElement>,
    targetDirPath: string | null
  ) => Promise<void>;
  isMutating: boolean;
}) {
  return (
    <>
      {nodes.map((node) => {
        const isExpanded = expandedPaths.has(node.path);
        const isSelected = node.path === selectedPath;
        const itemType = node.isDir ? "folder" : "file";
        const dropTargetDirPath = node.isDir ? node.path : toParentDirPath(node.path);
        const isDropTarget = dropTargetKey === toDropTargetKey(dropTargetDirPath);

        const handleRename = async () => {
          const nextName = window.prompt(`Rename ${itemType}`, node.name);
          if (nextName === null) return;

          const trimmedName = nextName.trim();
          if (!trimmedName || trimmedName === node.name) return;
          if (trimmedName.includes("/") || trimmedName.includes("\\")) {
            window.alert("Name cannot include '/' or '\\'.");
            return;
          }

          try {
            await onRenamePath(node.path, trimmedName);
          } catch (error) {
            window.alert(toErrorMessage(error));
          }
        };

        const handleDelete = async () => {
          const confirmed = window.confirm(
            node.isDir
              ? `Delete folder "${node.name}" and all its contents?`
              : `Delete file "${node.name}"?`
          );
          if (!confirmed) return;

          try {
            await onDeletePath(node.path);
          } catch (error) {
            window.alert(toErrorMessage(error));
          }
        };

        const contextMenu = (
          <ContextMenuContent>
            <ContextMenuItem
              disabled={isMutating}
              onSelect={() => {
                void handleRename();
              }}
            >
              <Pencil className="mr-1.5 size-3" />
              Rename
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
              disabled={isMutating}
              onSelect={() => {
                void handleDelete();
              }}
            >
              <Trash2 className="mr-1.5 size-3" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        );

        if (node.isDir) {
          return (
            <div key={node.path}>
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <button
                    className={cn(
                      "flex w-full items-center gap-1.5 py-[3px] pr-2 text-left text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground disabled:pointer-events-none disabled:opacity-60",
                      isDropTarget && "bg-primary/15 text-foreground"
                    )}
                    disabled={isMutating}
                    onDragOver={(event) => onDragOverTarget(event, node.path)}
                    onDrop={(event) => {
                      void onDropToTarget(event, node.path);
                    }}
                    onClick={() => onToggleDir(node.path)}
                    style={{ paddingLeft: `${depth * 14 + 8}px` }}
                    type="button"
                  >
                    <ChevronRight
                      className={`size-3 shrink-0 text-muted-foreground/60 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
                    />
                    {isExpanded ? (
                      <FolderOpen className="size-3.5 shrink-0 text-muted-foreground/75" />
                    ) : (
                      <Folder className="size-3.5 shrink-0 text-muted-foreground/75" />
                    )}
                    <span className="truncate">{node.name}</span>
                  </button>
                </ContextMenuTrigger>
                {contextMenu}
              </ContextMenu>
              {isExpanded && node.children.length > 0 ? (
                <TreeNodes
                  nodes={node.children}
                  depth={depth + 1}
                  dropTargetKey={dropTargetKey}
                  expandedPaths={expandedPaths}
                  onDeletePath={onDeletePath}
                  onDragOverTarget={onDragOverTarget}
                  onDropToTarget={onDropToTarget}
                  onRenamePath={onRenamePath}
                  onSelectFile={onSelectFile}
                  onToggleDir={onToggleDir}
                  selectedPath={selectedPath}
                  isMutating={isMutating}
                />
              ) : null}
            </div>
          );
        }

        return (
          <ContextMenu key={node.path}>
            <ContextMenuTrigger asChild>
              <button
                className={cn(
                  "flex w-full items-center gap-1.5 py-[3px] pr-2 text-left transition-colors disabled:pointer-events-none disabled:opacity-60",
                  isSelected
                    ? "bg-white/[0.08] text-foreground"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                  isDropTarget && "bg-primary/15 text-foreground"
                )}
                disabled={isMutating}
                onDragOver={(event) => onDragOverTarget(event, dropTargetDirPath)}
                onDrop={(event) => {
                  void onDropToTarget(event, dropTargetDirPath);
                }}
                onClick={() => onSelectFile(node.path)}
                style={{ paddingLeft: `${depth * 14 + 22}px` }}
                type="button"
              >
                <File className="size-3.5 shrink-0 text-muted-foreground/50" />
                <span className="truncate">{node.name}</span>
              </button>
            </ContextMenuTrigger>
            {contextMenu}
          </ContextMenu>
        );
      })}
    </>
  );
}

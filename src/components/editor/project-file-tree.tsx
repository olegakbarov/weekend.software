import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import {
  FileTree,
  prepareFileTreeInput,
  useFileTree,
} from "@weekend/design/registry";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ProjectTreeNode } from "@/lib/controller";

const ROOT_DROP_TARGET_KEY = "__ROOT__";

export type DroppedTreeFile = {
  file: File;
  sourcePath: string | null;
};

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

// Append trailing slash to directory paths so the lib treats them as explicit
// directories — this preserves empty folders (otherwise the lib infers
// directories from descendant paths only).
function flattenTreeToPaths(nodes: readonly ProjectTreeNode[]): string[] {
  const paths: string[] = [];
  const walk = (list: readonly ProjectTreeNode[]) => {
    for (const node of list) {
      if (node.isDir) {
        paths.push(`${node.path}/`);
        walk(node.children);
      } else {
        paths.push(node.path);
      }
    }
  };
  walk(nodes);
  return paths;
}

// Strip a trailing slash so we round-trip directory paths to the Weekend
// representation (no trailing slash).
function normalizeLibPath(path: string): string {
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

type PendingTarget = {
  path: string;
  name: string;
  isDir: boolean;
};

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
  const preparedInput = useMemo(
    () => prepareFileTreeInput(flattenTreeToPaths(tree)),
    [tree]
  );

  // Stable ref for `onSelectFile` so the model is constructed once without
  // re-binding the selection listener on each render.
  const onSelectFileRef = useRef(onSelectFile);
  useEffect(() => {
    onSelectFileRef.current = onSelectFile;
  }, [onSelectFile]);

  const { model } = useFileTree({
    initialExpansion: "open",
    preparedInput,
    onSelectionChange: (paths) => {
      const head = paths[0];
      if (!head) return;
      // The lib emits paths with trailing slash for directories. Only forward
      // file selection to the host — directory clicks just toggle expansion.
      if (head.endsWith("/")) return;
      onSelectFileRef.current(head);
    },
  });

  // Keep tree paths in sync when the input changes — `useFileTree` only reads
  // `options` once at mount, so we drive subsequent updates imperatively.
  const initialInputRef = useRef(preparedInput);
  useEffect(() => {
    if (initialInputRef.current === preparedInput) return;
    model.resetPaths([], { preparedInput });
  }, [model, preparedInput]);

  // Bridge external `selectedPath` → tree selection. Selection state lives
  // inside the model; we drive it imperatively when the host changes.
  useEffect(() => {
    if (selectedPath === null) return;
    const handle = model.getItem(selectedPath);
    if (!handle || handle.isSelected()) return;
    handle.select();
  }, [model, selectedPath]);

  // Drop target tracking for our wrapper-level drop handlers. The lib's tree
  // renders inside a shadow root, so we cannot resolve per-row drop targets
  // from drag events — file imports degrade to root-only.
  const [isDroppingAtRoot, setIsDroppingAtRoot] = useState(false);
  const handleDragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!onDropFiles || isMutating) return;
      if (!hasFilePayload(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";
      setIsDroppingAtRoot(true);
    },
    [isMutating, onDropFiles]
  );

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLElement>) => {
      if (!onDropFiles || isMutating) return;
      if (!hasFilePayload(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const droppedFiles = toDroppedTreeFiles(event.dataTransfer);
      setIsDroppingAtRoot(false);
      if (droppedFiles.length === 0) return;
      try {
        await onDropFiles(null, droppedFiles);
      } catch (error) {
        window.alert(toErrorMessage(error));
      }
    },
    [isMutating, onDropFiles]
  );

  // Confirm dialog state for rename + delete.
  const [pendingDelete, setPendingDelete] = useState<PendingTarget | null>(null);
  const [pendingRename, setPendingRename] = useState<PendingTarget | null>(null);

  const confirmDelete = useCallback(() => {
    const target = pendingDelete;
    if (!target) return;
    void onDeletePath(target.path).catch((error) => {
      window.alert(toErrorMessage(error));
    });
  }, [onDeletePath, pendingDelete]);

  const submitRename = useCallback(
    (nextName: string) => {
      const target = pendingRename;
      if (!target) return;
      const trimmed = nextName.trim();
      if (!trimmed || trimmed === target.name) {
        setPendingRename(null);
        return;
      }
      if (trimmed.includes("/") || trimmed.includes("\\")) {
        window.alert("Name cannot include '/' or '\\'.");
        return;
      }
      setPendingRename(null);
      void onRenamePath(target.path, trimmed).catch((error) => {
        window.alert(toErrorMessage(error));
      });
    },
    [onRenamePath, pendingRename]
  );

  // The lib invokes `renderContextMenu` on right-click and portals the
  // returned ReactNode anchored at the row.
  const renderContextMenu = useCallback(
    (
      item: { path: string; kind: "directory" | "file"; name: string },
      context: { close: (options?: { restoreFocus?: boolean }) => void }
    ): ReactNode => {
      const normalizedPath = normalizeLibPath(item.path);
      const isDir = item.kind === "directory";
      const target: PendingTarget = {
        path: normalizedPath,
        name: item.name,
        isDir,
      };
      return (
        <div
          className="z-50 min-w-[10rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
          data-file-tree-context-menu-root="true"
        >
          <button
            className="flex w-full cursor-default select-none items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
            disabled={isMutating}
            onClick={() => {
              context.close({ restoreFocus: false });
              setPendingRename(target);
            }}
            type="button"
          >
            <Pencil className="size-3" />
            Rename
          </button>
          <div className="-mx-1 my-1 h-px bg-border" />
          <button
            className="flex w-full cursor-default select-none items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-sm text-destructive outline-none hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
            disabled={isMutating}
            onClick={() => {
              context.close({ restoreFocus: false });
              setPendingDelete(target);
            }}
            type="button"
          >
            <Trash2 className="size-3" />
            Delete
          </button>
        </div>
      );
    },
    [isMutating]
  );

  return (
    <>
      <div
        className={cn(
          "h-full overflow-hidden",
          isDroppingAtRoot && "bg-primary/5"
        )}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
            return;
          }
          setIsDroppingAtRoot(false);
        }}
        onDragOver={handleDragOver}
        onDrop={(event) => {
          void handleDrop(event);
        }}
      >
        <FileTree
          model={model}
          renderContextMenu={renderContextMenu}
          style={{ height: "100%" }}
        />
      </div>
      <ConfirmDialog
        cancelText="Cancel"
        confirmText="Delete"
        message={
          pendingDelete
            ? pendingDelete.isDir
              ? `Delete folder "${pendingDelete.name}" and all its contents?`
              : `Delete file "${pendingDelete.name}"?`
            : ""
        }
        onConfirm={confirmDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        open={pendingDelete !== null}
        title={pendingDelete?.isDir ? "Delete folder?" : "Delete file?"}
        variant="danger"
      />
      <RenameDialog
        onCancel={() => setPendingRename(null)}
        onSubmit={submitRename}
        target={pendingRename}
      />
    </>
  );
}

function RenameDialog({
  target,
  onSubmit,
  onCancel,
}: {
  target: PendingTarget | null;
  onSubmit: (nextName: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");

  // Reset the input each time the dialog opens for a different target.
  useEffect(() => {
    if (target) setValue(target.name);
  }, [target]);

  const isOpen = target !== null;

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      open={isOpen}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {target?.isDir ? "Rename folder" : "Rename file"}
          </DialogTitle>
          <DialogDescription>
            {target
              ? `Enter a new name for ${target.isDir ? "folder" : "file"} "${target.name}".`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(value);
          }}
        >
          <Input
            autoFocus
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
            }}
            placeholder="New name"
            value={value}
          />
          <DialogFooter className="mt-4">
            <Button onClick={onCancel} size="sm" type="button" variant="outline">
              Cancel
            </Button>
            <Button size="sm" type="submit">
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

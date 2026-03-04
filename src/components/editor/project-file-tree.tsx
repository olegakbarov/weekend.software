import { useCallback, useState } from "react";
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
import type { ProjectTreeNode } from "@/lib/workspace-controller";

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
  isMutating = false,
}: {
  tree: ProjectTreeNode[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onRenamePath: (path: string, newName: string) => Promise<void>;
  onDeletePath: (path: string) => Promise<void>;
  isMutating?: boolean;
}) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

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
    <div className="h-full overflow-y-auto overflow-x-hidden py-1.5 font-code text-[15px] leading-relaxed">
      <TreeNodes
        nodes={tree}
        depth={0}
        expandedPaths={expandedPaths}
        selectedPath={selectedPath}
        onToggleDir={toggleDir}
        onSelectFile={onSelectFile}
        onRenamePath={onRenamePath}
        onDeletePath={onDeletePath}
        isMutating={isMutating}
      />
    </div>
  );
}

function TreeNodes({
  nodes,
  depth,
  expandedPaths,
  selectedPath,
  onToggleDir,
  onSelectFile,
  onRenamePath,
  onDeletePath,
  isMutating,
}: {
  nodes: ProjectTreeNode[];
  depth: number;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  onToggleDir: (path: string) => void;
  onSelectFile: (path: string) => void;
  onRenamePath: (path: string, newName: string) => Promise<void>;
  onDeletePath: (path: string) => Promise<void>;
  isMutating: boolean;
}) {
  return (
    <>
      {nodes.map((node) => {
        const isExpanded = expandedPaths.has(node.path);
        const isSelected = node.path === selectedPath;
        const itemType = node.isDir ? "folder" : "file";

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
                    className="flex w-full items-center gap-1.5 py-[3px] pr-2 text-left text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground disabled:pointer-events-none disabled:opacity-60"
                    disabled={isMutating}
                    onClick={() => onToggleDir(node.path)}
                    style={{ paddingLeft: `${depth * 14 + 8}px` }}
                    type="button"
                  >
                    <ChevronRight
                      className={`size-3 shrink-0 text-muted-foreground/60 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
                    />
                    {isExpanded ? (
                      <FolderOpen className="size-3.5 shrink-0 text-amber-500/80" />
                    ) : (
                      <Folder className="size-3.5 shrink-0 text-amber-500/80" />
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
                  expandedPaths={expandedPaths}
                  selectedPath={selectedPath}
                  onToggleDir={onToggleDir}
                  onSelectFile={onSelectFile}
                  onRenamePath={onRenamePath}
                  onDeletePath={onDeletePath}
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
                className={`flex w-full items-center gap-1.5 py-[3px] pr-2 text-left transition-colors disabled:pointer-events-none disabled:opacity-60 ${
                  isSelected
                    ? "bg-white/[0.08] text-foreground"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                }`}
                disabled={isMutating}
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

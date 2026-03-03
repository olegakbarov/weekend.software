import { useCallback, useState } from "react";
import { ChevronRight, File, Folder, FolderOpen } from "lucide-react";
import type { ProjectTreeNode } from "@/lib/workspace-controller";

export function ProjectFileTree({
  tree,
  selectedPath,
  onSelectFile,
}: {
  tree: ProjectTreeNode[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
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
}: {
  nodes: ProjectTreeNode[];
  depth: number;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  onToggleDir: (path: string) => void;
  onSelectFile: (path: string) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        const isExpanded = expandedPaths.has(node.path);
        const isSelected = node.path === selectedPath;

        if (node.isDir) {
          return (
            <div key={node.path}>
              <button
                className="flex w-full items-center gap-1.5 py-[3px] pr-2 text-left text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
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
              {isExpanded && node.children.length > 0 ? (
                <TreeNodes
                  nodes={node.children}
                  depth={depth + 1}
                  expandedPaths={expandedPaths}
                  selectedPath={selectedPath}
                  onToggleDir={onToggleDir}
                  onSelectFile={onSelectFile}
                />
              ) : null}
            </div>
          );
        }

        return (
          <button
            className={`flex w-full items-center gap-1.5 py-[3px] pr-2 text-left transition-colors ${
              isSelected
                ? "bg-white/[0.08] text-foreground"
                : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
            }`}
            key={node.path}
            onClick={() => onSelectFile(node.path)}
            style={{ paddingLeft: `${depth * 14 + 22}px` }}
            type="button"
          >
            <File className="size-3.5 shrink-0 text-muted-foreground/50" />
            <span className="truncate">{node.name}</span>
          </button>
        );
      })}
    </>
  );
}

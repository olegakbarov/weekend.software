import { useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PlayState } from "@/lib/controller";
import { useSidebarData, useSidebarActions } from "@/components/sidebar/sidebar-context";
import { ProjectStatusDot } from "@/components/sidebar/project-status-dot";
import { ProjectActionButton } from "@/components/sidebar/project-action-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export function SidebarProjectItem({
  project,
  isArchiveView = false,
}: {
  project: string;
  isArchiveView?: boolean;
}) {
  const data = useSidebarData();
  const actions = useSidebarActions();

  const isSelected = data.currentProject === project && !isArchiveView;
  const playState: PlayState = isArchiveView
    ? "idle"
    : (data.playStateByProject[project] ?? "idle");
  const playError = isArchiveView
    ? null
    : (data.playErrorByProject[project] ?? null);
  const isProjectRunning = playState === "running";

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project });

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const projectEditInputRef = useRef<HTMLInputElement>(null);

  const startProjectRename = () => {
    setIsEditingProject(true);
    setEditValue(project);
    requestAnimationFrame(() => projectEditInputRef.current?.select());
  };

  const commitProjectRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== project) {
      void actions.onRenameProject(project, trimmed);
    }
    setIsEditingProject(false);
  };

  return (
    <div
      ref={setNodeRef}
      className="min-w-0 px-1.5"
      style={sortableStyle}
      {...attributes}
    >
      {/* ── Project row ── */}
      {isEditingProject ? (
        <div className="flex w-full items-center gap-2.5 rounded-md bg-secondary px-2 py-1.5">
          <ProjectStatusDot running={isProjectRunning} />
          <input
            ref={projectEditInputRef}
            className="min-w-0 flex-1 bg-transparent font-vcr text-[13px] text-foreground outline-none"
            onBlur={commitProjectRename}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitProjectRename();
              if (e.key === "Escape") setIsEditingProject(false);
            }}
            value={editValue}
          />
        </div>
      ) : (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <button
              className={`group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${
                isSelected
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
              onClick={() => actions.onSelectBrowser(project)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                startProjectRename();
              }}
              type="button"
              {...listeners}
            >
              <ProjectStatusDot running={isProjectRunning} />
              <span className="min-w-0 flex-1 truncate font-vcr text-[13px]">
                {project}
              </span>
              <ProjectActionButton
                playState={playState}
                playError={playError}
                project={project}
                isArchiveView={isArchiveView}
                onPlay={actions.onPlay}
                onStop={actions.onStop}
                onUnarchiveProject={actions.onUnarchiveProject}
              />
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent className="min-w-[160px]">
            <ContextMenuItem onSelect={startProjectRename}>
              Rename
            </ContextMenuItem>
            {isArchiveView ? (
              <ContextMenuItem
                onSelect={() => void actions.onUnarchiveProject(project)}
              >
                Unarchive
              </ContextMenuItem>
            ) : (
              <ContextMenuItem
                onSelect={() => void actions.onArchiveProject(project)}
              >
                Archive
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-destructive data-[highlighted]:text-destructive"
              onSelect={() => setConfirmDeleteOpen(true)}
            >
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      )}

      <ConfirmDialog
        cancelText="Cancel"
        confirmText="Delete"
        message={`Delete project "${project}"? This removes the directory at ~/.weekend/${project} and cannot be undone.`}
        onConfirm={() => void actions.onDeleteProject(project)}
        onOpenChange={setConfirmDeleteOpen}
        open={confirmDeleteOpen}
        title="Delete project"
        variant="danger"
      />
    </div>
  );
}

import { Archive, FileText, Plus, Settings, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { SidebarProjectItem } from "@/components/sidebar/sidebar-project-item";
import type { ActiveView } from "@/lib/types";
import type { TerminalSessionDescriptor } from "@/lib/types";
import type { PlayState } from "@/lib/workspace-controller";

export function Sidebar({
  activeView,
  activeTerminalId,
  projects,
  terminalSessionsByProject,
  playStateByProject,
  playErrorByProject,
  isCreatingProject,
  isNamingProject,
  projectNameDraft,
  onProjectNameDraftChange,
  onStartNamingProject,
  onCancelNamingProject,
  onCreateProject,
  onSelectBrowser,
  onSelectTerminal,
  onCreateTerminal,
  onRenameTerminal,
  onRenameProject,
  onRemoveTerminal,
  onPlay,
  onStop,
  onReorderProjects,
  onOpenSettings,
  onOpenLogs,
  showArchived,
  archivedProjects,
  onToggleShowArchived,
  onUnarchiveProject,
}: {
  activeView: ActiveView;
  activeTerminalId: string | null;
  projects: string[];
  terminalSessionsByProject: Record<string, TerminalSessionDescriptor[]>;
  playStateByProject: Record<string, PlayState>;
  playErrorByProject: Record<string, string | null>;
  isCreatingProject: boolean;
  isNamingProject: boolean;
  projectNameDraft: string;
  onProjectNameDraftChange: (value: string) => void;
  onStartNamingProject: () => void;
  onCancelNamingProject: () => void;
  onCreateProject: () => Promise<void>;
  onSelectBrowser: (project: string) => void;
  onSelectTerminal: (project: string, terminalId: string) => void;
  onCreateTerminal: (project: string) => void;
  onRenameTerminal: (terminalId: string, newLabel: string) => void;
  onRenameProject: (oldName: string, newName: string) => Promise<void>;
  onRemoveTerminal: (terminalId: string) => void;
  onReorderProjects: (reordered: string[]) => void;
  onPlay: (project: string) => void;
  onStop: (project: string) => void;
  onOpenSettings: () => void;
  onOpenLogs: () => void;
  showArchived: boolean;
  archivedProjects: string[];
  onToggleShowArchived: () => void;
  onUnarchiveProject: (project: string) => Promise<void>;
}) {
  const selectedProject =
    activeView.route === "workspace" ? activeView.project : null;
  const displayedProjects = showArchived ? archivedProjects : projects;

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const sensors = useSensors(pointerSensor, keyboardSensor);
  const trafficLightsSafeZonePx = 72;
  const newProjectButtonHeightPx = 33;

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = projects.indexOf(active.id as string);
      const newIndex = projects.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      onReorderProjects(arrayMove(projects, oldIndex, newIndex));
    },
    [projects, onReorderProjects]
  );

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-border border-r bg-background">
      {/* ── Header row: traffic lights + archive label/drag area ── */}
      <div className="shrink-0 px-2">
        <div className="flex h-12 items-center gap-2">
          <div
            className="h-full shrink-0"
            data-tauri-drag-region
            style={{ width: `${trafficLightsSafeZonePx}px` }}
          />
          {showArchived ? (
            <div
              className="flex min-w-0 flex-1 items-center justify-center font-vcr text-[12px] text-muted-foreground/50"
              data-tauri-drag-region
            >
              ARCHIVED PROJECTS
            </div>
          ) : (
            <div className="min-w-0 flex-1" data-tauri-drag-region />
          )}
        </div>
      </div>

      {/* ── Project list ── */}
      <div className="flex min-h-0 flex-1 flex-col px-1.5">
        {showArchived ? (
          <div className="min-h-0 flex-1 space-y-px overflow-auto py-0.5">
            {displayedProjects.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="font-code text-xs text-muted-foreground/40">
                  No archived projects
                </p>
              </div>
            ) : (
              displayedProjects.map((project) => (
                <SidebarProjectItem
                  activeTerminalId={null}
                  isActiveProject={false}
                  isArchiveView
                  isSelected={false}
                  key={project}
                  onCreateTerminal={onCreateTerminal}
                  onPlay={onPlay}
                  onStop={onStop}
                  onRenameProject={onRenameProject}
                  onRenameTerminal={onRenameTerminal}
                  onRemoveTerminal={onRemoveTerminal}
                  onSelectBrowser={onSelectBrowser}
                  onSelectTerminal={onSelectTerminal}
                  onUnarchiveProject={onUnarchiveProject}
                  playState="idle"
                  project={project}
                  terminalSessions={[]}
                />
              ))
            )}
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="min-h-0 flex-1 space-y-px overflow-auto py-1">
              {isNamingProject ? (
                <div className="pb-1">
                  <InlineNewProject
                    isCreating={isCreatingProject}
                    onCancel={onCancelNamingProject}
                    onChange={onProjectNameDraftChange}
                    onCreate={onCreateProject}
                    value={projectNameDraft}
                  />
                </div>
              ) : (
                <button
                  className="mb-[29px] flex w-full items-center gap-2.5 rounded-md border border-border/30 px-2 text-left font-vcr text-[13px] text-muted-foreground transition-colors hover:border-border/60 hover:text-foreground/70"
                  onClick={onStartNamingProject}
                  style={{ height: `${newProjectButtonHeightPx}px` }}
                  type="button"
                >
                  <span className="inline-flex size-1.5 shrink-0 items-center justify-center">
                    <Plus className="size-[0.9rem] shrink-0" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">NEW PROJECT</span>
                </button>
              )}
              <SortableContext items={projects} strategy={verticalListSortingStrategy}>
                {displayedProjects.map((project) => (
                  <SidebarProjectItem
                    activeTerminalId={activeTerminalId}
                    isActiveProject={selectedProject === project}
                    isSelected={selectedProject === project}
                    key={project}
                    onCreateTerminal={onCreateTerminal}
                    onPlay={onPlay}
                    onStop={onStop}
                    onRenameProject={onRenameProject}
                    onRenameTerminal={onRenameTerminal}
                    onRemoveTerminal={onRemoveTerminal}
                    onSelectBrowser={onSelectBrowser}
                    onSelectTerminal={onSelectTerminal}
                    playState={playStateByProject[project] ?? "idle"}
                    playError={playErrorByProject[project] ?? null}
                    project={project}
                    terminalSessions={
                      terminalSessionsByProject[project] ?? []
                    }
                  />
                ))}
              </SortableContext>
            </div>
          </DndContext>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="flex shrink-0 items-center border-border/40 border-t px-2 py-1">
        <div className="flex items-center gap-0.5">
          <FooterIconButton
            active={activeView.route === "logs"}
            icon={<FileText className="size-3.5" />}
            onClick={onOpenLogs}
            title="Logs"
          />
          <FooterIconButton
            active={showArchived}
            icon={<Archive className="size-3.5" />}
            onClick={onToggleShowArchived}
            title={showArchived ? "Show active projects" : "Show archived projects"}
          />
          <FooterIconButton
            active={activeView.route === "settings"}
            icon={<Settings className="size-3.5" />}
            onClick={onOpenSettings}
            title="Settings"
          />
        </div>
      </div>
    </aside>
  );
}

/* ── Shared footer icon button ── */
function FooterIconButton({
  active,
  icon,
  onClick,
  title,
}: {
  active?: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      className={`rounded p-1.5 transition-colors ${
        active
          ? "text-foreground"
          : "text-muted-foreground/60 hover:text-foreground"
      }`}
      onClick={onClick}
      title={title}
      type="button"
    >
      {icon}
    </button>
  );
}

/* ── Inline project creation input ── */
function InlineNewProject({
  isCreating,
  onCancel,
  onChange,
  onCreate,
  value,
}: {
  isCreating: boolean;
  onCancel: () => void;
  onChange: (value: string) => void;
  onCreate: () => Promise<void>;
  value: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex items-center gap-1 rounded-md border border-border/60 bg-input px-2 py-0.5">
      <input
        ref={inputRef}
        className="min-w-0 flex-1 bg-transparent py-0.5 font-code text-xs text-foreground placeholder:text-muted-foreground/40 outline-none"
        disabled={isCreating}
        onBlur={() => {
          if (!isCreating && !value.trim()) onCancel();
        }}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) void onCreate();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="project name"
        value={value}
      />
      <button
        className="shrink-0 p-0.5 text-muted-foreground/40 hover:text-foreground"
        onClick={onCancel}
        type="button"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

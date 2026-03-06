import { Archive, FileText, Plus, Settings } from "lucide-react";
import { useCallback } from "react";
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
import type { TerminalSessionDescriptor, PlayState } from "@/lib/controller";
import { cn } from "@/lib/utils";

export function Sidebar({
  currentProject,
  currentRoute,
  activeTerminalId,
  projects,
  terminalSessionsByProject,
  playStateByProject,
  playErrorByProject,
  isFullscreen,
  onOpenHome,
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
  currentProject: string | null;
  currentRoute: string;
  activeTerminalId: string | null;
  projects: string[];
  terminalSessionsByProject: Record<string, TerminalSessionDescriptor[]>;
  playStateByProject: Record<string, PlayState>;
  playErrorByProject: Record<string, string | null>;
  isFullscreen: boolean;
  onOpenHome: () => void;
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
  const displayedProjects = showArchived ? archivedProjects : projects;

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const sensors = useSensors(pointerSensor, keyboardSensor);
  const trafficLightsSafeZonePx = 72;
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
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-border border-r bg-background">
      <div className="shrink-0 px-2">
        <div className="flex h-12 items-center">
          {!isFullscreen ? (
            <div
              className="h-full shrink-0"
              data-tauri-drag-region
              style={{ width: `${trafficLightsSafeZonePx}px` }}
            />
          ) : null}
          <div
            className={cn(
              "min-w-0 flex-1 px-2",
              showArchived
                ? "flex items-center justify-center font-vcr text-[12px] text-muted-foreground/50"
                : null
            )}
            data-tauri-drag-region={!isFullscreen || undefined}
          >
            {showArchived ? "ARCHIVED PROJECTS" : null}
          </div>
          <button
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-2 rounded-md border px-3 font-vcr text-[12px] uppercase tracking-wide leading-none shadow-sm transition-colors",
              currentRoute === "home"
                ? "border-primary/70 bg-primary text-primary-foreground shadow-primary/20"
                : "border-primary/35 bg-primary/90 text-primary-foreground shadow-primary/15 hover:bg-primary hover:shadow-primary/20"
            )}
            onClick={onOpenHome}
            title="New project"
            type="button"
          >
            <Plus className="size-3.5 shrink-0" />
            <span>New</span>
          </button>
        </div>
      </div>

      {/* ── Project list ── */}
      <div className="flex min-h-0 flex-1 flex-col px-1.5">
        {showArchived ? (
            <div
              className={cn(
                "min-h-0 flex-1 space-y-px overflow-auto",
                "py-0.5"
              )}
            >
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
            <div
              className={cn(
                "min-h-0 flex-1 space-y-px overflow-auto",
                "py-1"
              )}
            >
              <SortableContext items={projects} strategy={verticalListSortingStrategy}>
                {displayedProjects.map((project) => (
                  <SidebarProjectItem
                    activeTerminalId={activeTerminalId}
                    isActiveProject={currentProject === project}
                    isSelected={currentProject === project}
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
            active={currentRoute === "logs"}
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
            active={currentRoute === "settings"}
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

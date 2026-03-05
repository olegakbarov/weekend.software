import {
  AlertTriangle,
  ArchiveRestore,
  Loader2,
  Play,
  Plus,
  Square,
  Terminal as TerminalIcon,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  type TerminalSessionDescriptor,
  type PlayState,
  terminalDisplayLabel,
} from "@/lib/controller";

export function SidebarProjectItem({
  project,
  isSelected,
  isActiveProject,
  activeTerminalId,
  terminalSessions,
  playState,
  playError,
  onSelectBrowser,
  onSelectTerminal,
  onCreateTerminal,
  onRenameProject,
  onRenameTerminal,
  onRemoveTerminal,
  onPlay,
  onStop,
  isArchiveView = false,
  onUnarchiveProject,
}: {
  project: string;
  isSelected: boolean;
  isActiveProject: boolean;
  activeTerminalId: string | null;
  terminalSessions: TerminalSessionDescriptor[];
  playState: PlayState;
  playError?: string | null;
  onSelectBrowser: (project: string) => void;
  onSelectTerminal: (project: string, terminalId: string) => void;
  onCreateTerminal: (project: string) => void;
  onRenameProject: (oldName: string, newName: string) => Promise<void>;
  onRenameTerminal: (terminalId: string, newLabel: string) => void;
  onRemoveTerminal: (terminalId: string) => void;
  onPlay: (project: string) => void;
  onStop: (project: string) => void;
  isArchiveView?: boolean;
  onUnarchiveProject?: (project: string) => Promise<void>;
}) {
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

  const [editingTerminalId, setEditingTerminalId] = useState<string | null>(
    null
  );
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const projectEditInputRef = useRef<HTMLInputElement>(null);
  const isProjectRunning = playState === "running";

  const startProjectRename = () => {
    setIsEditingProject(true);
    setEditValue(project);
    requestAnimationFrame(() => projectEditInputRef.current?.select());
  };

  const commitProjectRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== project) {
      void onRenameProject(project, trimmed);
    }
    setIsEditingProject(false);
  };

  const startRename = (terminalId: string, currentLabel: string) => {
    setEditingTerminalId(terminalId);
    setEditValue(currentLabel);
    requestAnimationFrame(() => editInputRef.current?.select());
  };

  const commitRename = () => {
    if (editingTerminalId && editValue.trim()) {
      onRenameTerminal(editingTerminalId, editValue.trim());
    }
    setEditingTerminalId(null);
  };

  return (
    <div ref={setNodeRef} style={sortableStyle} {...attributes}>
      {/* ── Project row ── */}
      {isEditingProject ? (
        <div className="flex w-full items-center gap-2.5 rounded-md bg-secondary px-2 py-1.5">
          <span
            className={`inline-block size-1.5 shrink-0 rounded-full transition-colors ${
              isProjectRunning
                ? "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]"
                : "bg-muted-foreground/25"
            }`}
          />
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
        <button
          className={`group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${
            isSelected
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
          }`}
          onClick={() => onSelectBrowser(project)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            startProjectRename();
          }}
          type="button"
          {...listeners}
        >
          <span
            className={`inline-block size-1.5 shrink-0 rounded-full transition-colors ${
              isProjectRunning
                ? "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]"
                : "bg-muted-foreground/25"
            }`}
          />
          <span className="min-w-0 flex-1 truncate font-vcr text-[13px]">
            {project}
          </span>

          {/* Inline play/stop or unarchive button */}
          {isArchiveView ? (
            <span
              className="shrink-0 rounded p-0.5 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/40 hover:!text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                if (onUnarchiveProject) void onUnarchiveProject(project);
              }}
              role="button"
              title="Unarchive project"
            >
              <ArchiveRestore className="size-3" />
            </span>
          ) : (
            <span
              className={`shrink-0 rounded p-0.5 transition-colors ${
                playState === "starting"
                  ? "text-muted-foreground/60"
                  : playState === "failed"
                    ? "text-destructive"
                    : playState === "running"
                    ? "text-muted-foreground/0 group-hover:text-muted-foreground/40 hover:!text-foreground"
                    : "text-muted-foreground/0 group-hover:text-muted-foreground/40 hover:!text-foreground"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (playState === "starting") return;
                if (playState === "running") {
                  onStop(project);
                } else {
                  onPlay(project);
                }
              }}
              role="button"
              title={
                playState === "starting"
                  ? "Starting..."
                  : playState === "running"
                    ? "Stop processes"
                    : playState === "failed"
                      ? `Start failed. Click to retry.${playError ? ` ${playError}` : ""}`
                      : "Start processes"
              }
            >
              {playState === "starting" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : playState === "running" ? (
                <Square className="size-3" />
              ) : playState === "failed" ? (
                <AlertTriangle className="size-3" />
              ) : (
                <Play className="size-3" />
              )}
            </span>
          )}

        </button>
      )}

      {/* ── Terminal sessions + new terminal button ── */}
      {isSelected && !isArchiveView && (
        <div className="ml-[18px] mt-px space-y-px pb-0.5">
          {terminalSessions.map((session) => (
            <div
              className="group/term flex items-center"
              key={session.terminalId}
            >
              {editingTerminalId === session.terminalId ? (
                <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1">
                  <TerminalIcon className="size-3 shrink-0 text-muted-foreground" />
                  <input
                    ref={editInputRef}
                    className="min-w-0 flex-1 bg-transparent font-code text-[13px] text-foreground outline-none"
                    onBlur={commitRename}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setEditingTerminalId(null);
                    }}
                    value={editValue}
                  />
                </div>
              ) : (
                <>
                  <button
                    className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left font-code text-[13px] transition-colors ${
                      activeTerminalId === session.terminalId
                        ? "text-foreground"
                        : session.status === "exited"
                          ? "text-muted-foreground/35 hover:bg-secondary/40 hover:text-muted-foreground"
                          : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTerminal(project, session.terminalId);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startRename(
                        session.terminalId,
                        terminalDisplayLabel(session)
                      );
                    }}
                    type="button"
                  >
                    <TerminalIcon
                      className={`size-3 shrink-0 ${
                        activeTerminalId === session.terminalId
                          ? "animate-pulse text-foreground"
                          : session.status === "exited"
                            ? "opacity-30"
                            : "opacity-50"
                      }`}
                    />
                    <span className="truncate">
                      {terminalDisplayLabel(session)}
                    </span>
                  </button>
                  <button
                    className="shrink-0 rounded p-0.5 text-muted-foreground/0 transition-colors hover:text-destructive group-hover/term:text-muted-foreground/25"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveTerminal(session.terminalId);
                    }}
                    title="Close terminal"
                    type="button"
                  >
                    <X className="size-3" />
                  </button>
                </>
              )}
            </div>
          ))}
          <button
            className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left font-vcr text-[12px] text-muted-foreground/40 transition-colors hover:text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onCreateTerminal(project);
            }}
            type="button"
          >
            <Plus className="size-3 shrink-0" />
            NEW TERMINAL
          </button>
        </div>
      )}
    </div>
  );
}

import { AlertTriangle, ArchiveRestore, Loader2, Play, Square } from "lucide-react";
import type { PlayState } from "@/lib/controller";

export function ProjectActionButton({
  playState,
  playError,
  project,
  isArchiveView,
  onPlay,
  onStop,
  onUnarchiveProject,
}: {
  playState: PlayState;
  playError?: string | null;
  project: string;
  isArchiveView: boolean;
  onPlay: (project: string) => void;
  onStop: (project: string) => void;
  onUnarchiveProject?: (project: string) => Promise<void>;
}) {
  if (isArchiveView) {
    return (
      <span
        className="relative shrink-0 rounded p-0.5 text-muted-foreground/0 transition-colors before:absolute before:-inset-3 before:content-[''] group-hover:text-muted-foreground/40 hover:!text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          if (onUnarchiveProject) void onUnarchiveProject(project);
        }}
        role="button"
        title="Unarchive project"
      >
        <ArchiveRestore className="size-3" />
      </span>
    );
  }

  return (
    <span
      className={`relative shrink-0 rounded p-0.5 transition-colors before:absolute before:-inset-3 before:content-[''] ${
        playState === "starting"
          ? "text-muted-foreground/60"
          : playState === "failed"
            ? "text-destructive"
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
  );
}

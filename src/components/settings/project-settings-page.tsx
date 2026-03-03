import { AlertTriangle, Archive, Loader2, Play, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlayState } from "@/lib/workspace-controller";

export type ProjectSettingsPageProps = {
  project: string;
  configPath: string | null;
  playState: PlayState;
  playError: string | null;
  onPlayProject: () => Promise<void>;
  onStopProject: () => void;
  isArchivingProject: boolean;
  onArchiveProject: () => Promise<void>;
  isDeletingProject: boolean;
  onDeleteProject: () => Promise<void>;
};

export function ProjectSettingsPage({
  project,
  configPath,
  playState,
  playError,
  onPlayProject,
  onStopProject,
  isArchivingProject,
  onArchiveProject,
  isDeletingProject,
  onDeleteProject,
}: ProjectSettingsPageProps) {
  const isStarting = playState === "starting";
  const isRunning = playState === "running";
  const isFailed = playState === "failed";

  return (
    <section className="flex h-full min-h-0 flex-col overflow-auto p-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header>
          <h1 className="font-code text-sm text-foreground">Project Settings</h1>
          <p className="mt-1 font-code text-xs text-muted-foreground">{project}</p>
        </header>

        <div className="rounded-lg border border-border/70 bg-background/60 p-4">
          <div className="space-y-3">
            <h2 className="font-code text-xs text-foreground">Lifecycle</h2>
            <p className="font-code text-xs text-muted-foreground">
              Start or stop project runtime processes defined in
              <span className="px-1 text-foreground/80">
                {configPath ?? "runtime config"}
              </span>
              without changing project config.
            </p>
            <Button
              className={isFailed ? "text-destructive" : "text-foreground"}
              disabled={isStarting}
              onClick={() => {
                if (isRunning) {
                  onStopProject();
                  return;
                }
                void onPlayProject();
              }}
              size="sm"
              variant="ghost"
            >
              {isStarting ? (
                <Loader2 className="mr-1.5 size-3 animate-spin" />
              ) : isRunning ? (
                <Square className="mr-1.5 size-3" />
              ) : isFailed ? (
                <AlertTriangle className="mr-1.5 size-3" />
              ) : (
                <Play className="mr-1.5 size-3" />
              )}
              {isStarting
                ? "Starting..."
                : isRunning
                  ? "[] stop project"
                  : "|> start project"}
            </Button>
            {isFailed && playError ? (
              <p className="font-code text-xs text-destructive/80">{playError}</p>
            ) : null}
            <p className="font-code text-xs text-muted-foreground">
              Archive this project to hide it from the active list. You can
              unarchive it later from the sidebar.
            </p>
            <Button
              className="text-foreground"
              disabled={isArchivingProject}
              onClick={() => {
                void onArchiveProject();
              }}
              size="sm"
              variant="ghost"
            >
              <Archive className="mr-1.5 size-3" />
              {isArchivingProject ? "Archiving..." : "Archive Project"}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="space-y-3">
            <h2 className="font-code text-xs text-destructive">Danger Zone</h2>
            <p className="font-code text-xs text-muted-foreground">
              Permanently remove this project from the workspace and delete its
              project directory.
            </p>
            <Button
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={isDeletingProject}
              onClick={() => {
                void onDeleteProject();
              }}
              size="sm"
              variant="ghost"
            >
              <Trash2 className="mr-1.5 size-3" />
              {isDeletingProject ? "Deleting..." : "Delete Project"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

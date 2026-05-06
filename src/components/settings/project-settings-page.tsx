import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Loader2,
  Play,
  Save,
  Square,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EnvVarsEditor } from "@/components/ui/env-vars-editor";
import { Input } from "@/components/ui/input";
import type {
  PlayState,
  ProjectConfigReadSnapshot,
} from "@/lib/controller";

const DEFAULT_PORTLESS_PROXY_PORT = 1355;

function localRuntimeAddressForProject(project: string): string {
  const normalized = project
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const slug = normalized || "app";
  return `http://${slug}.localhost:${DEFAULT_PORTLESS_PROXY_PORT}`;
}

export type ProjectSettingsPageProps = {
  project: string;
  configPath: string | null;
  projectConfigSnapshot: ProjectConfigReadSnapshot | null;
  playState: PlayState;
  playError: string | null;
  onPlayProject: () => Promise<void>;
  onStopProject: () => void;
  isArchivingProject: boolean;
  onArchiveProject: () => Promise<void>;
  isDeletingProject: boolean;
  onDeleteProject: () => Promise<void>;
  onUpdateEnv: (env: Record<string, string>) => Promise<void>;
  onUpdateDeployUrl: (deployUrl: string | null) => Promise<void>;
};

export function ProjectSettingsPage({
  project,
  configPath,
  projectConfigSnapshot,
  playState,
  playError,
  onPlayProject,
  onStopProject,
  isArchivingProject,
  onArchiveProject,
  isDeletingProject,
  onDeleteProject,
  onUpdateEnv,
  onUpdateDeployUrl,
}: ProjectSettingsPageProps) {
  const isStarting = playState === "starting";
  const isRunning = playState === "running";
  const isFailed = playState === "failed";
  const currentDeployUrl = projectConfigSnapshot?.deployUrl?.trim() ?? "";
  const [deployUrlDraft, setDeployUrlDraft] = useState(currentDeployUrl);
  const [deployUrlError, setDeployUrlError] = useState<string | null>(null);
  const [isDeployUrlSaving, setIsDeployUrlSaving] = useState(false);
  const runtimeAddress = useMemo(
    () =>
      projectConfigSnapshot?.runtimeUrl?.trim() ||
      localRuntimeAddressForProject(project),
    [project, projectConfigSnapshot?.runtimeUrl]
  );
  const normalizedDeployUrlDraft = deployUrlDraft.trim();
  const hasDeployUrlChanges = normalizedDeployUrlDraft !== currentDeployUrl;

  useEffect(() => {
    setDeployUrlDraft(currentDeployUrl);
    setDeployUrlError(null);
  }, [currentDeployUrl, project]);

  const handleSaveDeployUrl = async () => {
    if (!hasDeployUrlChanges || isDeployUrlSaving) return;
    setIsDeployUrlSaving(true);
    setDeployUrlError(null);
    try {
      await onUpdateDeployUrl(normalizedDeployUrlDraft || null);
    } catch (error) {
      setDeployUrlError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsDeployUrlSaving(false);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-auto p-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header>
          <h1 className="font-code text-sm text-foreground">Project Settings</h1>
          <p className="mt-1 font-code text-xs text-muted-foreground">{project}</p>
        </header>

        <div className="rounded-lg border border-border/70 bg-background/60 p-4">
          <div className="space-y-3">
            <h2 className="font-code text-xs text-foreground">Runtime Address</h2>
            <p className="font-code text-xs text-muted-foreground">
              Weekend runs in portless mode only. Runtime addresses are generated
              from sanitized project names.
            </p>
            <label className="space-y-1">
              <span className="font-code text-xs text-foreground">Local Address</span>
              <Input
                className="h-8 font-code text-xs"
                readOnly
                type="text"
                value={runtimeAddress}
              />
            </label>
            <label className="space-y-1">
              <span className="font-code text-xs text-foreground">Deployed Address</span>
              <div className="flex gap-2">
                <Input
                  className="h-8 min-w-0 flex-1 font-code text-xs"
                  onChange={(event) => {
                    setDeployUrlDraft(event.target.value);
                    setDeployUrlError(null);
                  }}
                  placeholder="https://example.com"
                  type="url"
                  value={deployUrlDraft}
                />
                <Button
                  disabled={!hasDeployUrlChanges || isDeployUrlSaving}
                  onClick={() => {
                    void handleSaveDeployUrl();
                  }}
                  size="sm"
                  variant="ghost"
                >
                  {isDeployUrlSaving ? (
                    <Loader2 className="mr-1.5 size-3 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 size-3" />
                  )}
                  Save
                </Button>
              </div>
            </label>
            {deployUrlError ? (
              <p className="font-code text-xs text-destructive/80">
                {deployUrlError}
              </p>
            ) : null}
          </div>
        </div>

        <EnvVarsEditor
          env={projectConfigSnapshot?.env ?? {}}
          onUpdate={onUpdateEnv}
          title="Environment Variables"
          description="Variables injected into all terminal sessions for this project. These override shared environment variables."
        />

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

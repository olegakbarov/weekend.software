import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BrowserPane } from "@/components/browser/browser-pane";
import { ProjectEditorPane } from "@/components/editor/project-editor-pane";
import { ProjectSettingsPage } from "@/components/settings/project-settings-page";
import { TerminalView } from "@/components/terminal/terminal-view";
import { useProjectActions } from "@/hooks/use-project-actions";
import { useVimMode } from "@/hooks/use-vim-mode";
import { useWorkspaceState } from "@/hooks/use-workspace-state";
import {
  buildWorkspaceLocation,
  isTerminalOwnedByProject,
  type WorkspaceSearch,
} from "@/lib/workspace-navigation";

export const Route = createFileRoute("/workspace/$project")({
  validateSearch: (search: Record<string, unknown>): WorkspaceSearch => {
    const view = search.view as string | undefined;
    const validViews = ["browser", "editor", "terminal", "settings"];
    return {
      view: validViews.includes(view ?? "") ? (view as WorkspaceSearch["view"]) : "browser",
      terminalId: (search.terminalId as string) ?? undefined,
    };
  },
  component: WorkspaceRoute,
});

function WorkspaceRoute() {
  const { controller } = Route.useRouteContext();
  const state = useWorkspaceState(controller);
  const { project } = Route.useParams();
  const { view, terminalId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const projectActions = useProjectActions(controller, state, project);
  const [isVimModeEnabled, setIsVimModeEnabled] = useVimMode();
  const [selectedEditorFilePathByProject, setSelectedEditorFilePathByProject] =
    useState<Record<string, string | null>>({});
  const [lastNonTerminalViewByProject, setLastNonTerminalViewByProject] =
    useState<Record<string, "browser" | "editor">>({});

  const selectedEditorFilePath = selectedEditorFilePathByProject[project] ?? null;
  const projectTree = state.projectTreeByProject[project] ?? [];
  const projectConfigSnapshot =
    state.projectConfigSnapshotByProject[project] ?? null;
  const isProjectConfigLoading =
    state.projectConfigLoadingByProject[project] ?? false;
  const projectConfigError =
    state.projectConfigErrorByProject[project] ?? null;
  const playState = state.playStateByProject[project] ?? "idle";
  const filesystemEventVersion =
    state.filesystemEventVersionByProject[project] ??
    state.filesystemEventVersion;
  const hasHealthyRuntimeProcess =
    state.runtimeProcessHealthyByProject[project] ?? false;

  const isTerminalRouteOwnedByProject =
    view === "terminal" &&
    isTerminalOwnedByProject(project, terminalId);
  const activeTerminalId =
    view === "terminal" && isTerminalRouteOwnedByProject ? terminalId : null;
  const activeTerminalSession = activeTerminalId
    ? (state.terminalSessionsByProject[project] ?? []).find(
        (s) => s.terminalId === activeTerminalId
      ) ?? null
    : null;
  const activeTerminalLabel = activeTerminalSession?.displayName ?? null;

  const getNonTerminalViewForProject = useCallback(
    (proj: string): "browser" | "editor" => {
      const remembered = lastNonTerminalViewByProject[proj];
      if (remembered) return remembered;
      const ps = state.playStateByProject[proj] ?? "idle";
      return ps === "running" ? "browser" : "editor";
    },
    [lastNonTerminalViewByProject, state.playStateByProject]
  );

  // Track last non-terminal view
  useEffect(() => {
    if (view !== "browser" && view !== "editor") return;
    setLastNonTerminalViewByProject((prev) => {
      if (prev[project] === view) return prev;
      return { ...prev, [project]: view };
    });
  }, [project, view]);

  // Auto-load project config
  useEffect(() => {
    controller.selectProject(project);
  }, [controller, project]);

  useEffect(() => {
    if (projectConfigSnapshot) return;
    if (isProjectConfigLoading) return;
    if (projectConfigError !== null) return;
    void controller.refreshProjectConfig(project).catch(() => undefined);
  }, [
    controller,
    isProjectConfigLoading,
    project,
    projectConfigError,
    projectConfigSnapshot,
  ]);

  // Terminal existence guard — navigate away if the terminal no longer exists
  useEffect(() => {
    if (view !== "terminal" || !terminalId) return;
    const hasTerminal =
      isTerminalRouteOwnedByProject &&
      (state.terminalSessionsByProject[project] ?? []).some(
        (session) => session.terminalId === terminalId
      );
    if (!hasTerminal) {
      const fallback = getNonTerminalViewForProject(project);
      void navigate(buildWorkspaceLocation(project, { view: fallback }));
    }
  }, [
    view,
    terminalId,
    project,
    state.terminalSessionsByProject,
    isTerminalRouteOwnedByProject,
    getNonTerminalViewForProject,
    navigate,
  ]);

  const handleSelectedFilePathChange = useCallback(
    (path: string | null) => {
      setSelectedEditorFilePathByProject((prev) => ({
        ...prev,
        [project]: path,
      }));
    },
    [project]
  );

  const handleProjectTreeMutated = useCallback(
    async (proj: string) => {
      await controller.refreshProjectTree(proj);
    },
    [controller]
  );

  const handlePlayFromSettings = useCallback(async () => {
    await projectActions.playFromSettings();
  }, [projectActions]);

  const handleStopFromSettings = useCallback(() => {
    projectActions.stop();
  }, [projectActions]);

  const workspaceMode = useMemo(() => {
    if (view === "editor") return "editor" as const;
    if (view === "settings") return "settings" as const;
    if (view === "terminal") {
      return activeTerminalSession?.processRole === "agent"
        ? ("agent" as const)
        : ("terminal" as const);
    }
    return "browser" as const;
  }, [view, activeTerminalSession?.processRole]);

  return (
    <div className="relative min-h-0 flex flex-1 flex-col overflow-hidden">
      <BrowserPane
        agentContent={
          activeTerminalId ? (
            <TerminalView
              key={activeTerminalId}
              project={project}
              terminalId={activeTerminalId}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="font-code text-sm text-muted-foreground/50">
                No terminal selected
              </p>
            </div>
          )
        }
        editorContent={
          <ProjectEditorPane
            isVimModeEnabled={isVimModeEnabled}
            onVimModeEnabledChange={setIsVimModeEnabled}
            onProjectTreeMutated={handleProjectTreeMutated}
            project={project}
            projectTree={projectTree}
            requestedFilePath={selectedEditorFilePath}
            onSelectedFilePathChange={handleSelectedFilePathChange}
          />
        }
        settingsContent={
          <ProjectSettingsPage
            project={project}
            configPath={projectConfigSnapshot?.configPath ?? null}
            projectConfigSnapshot={projectConfigSnapshot}
            playState={playState}
            playError={state.playErrorByProject[project] ?? null}
            onPlayProject={handlePlayFromSettings}
            onStopProject={handleStopFromSettings}
            isArchivingProject={projectActions.isArchivingProject}
            onArchiveProject={projectActions.archiveProject}
            isDeletingProject={projectActions.isDeletingProject}
            onDeleteProject={projectActions.deleteProject}
          />
        }
        agentTerminalLabel={activeTerminalLabel}
        onElementGrabbed={projectActions.elementGrabbed}
        onWorkspaceModeChange={projectActions.workspaceModeChange}
        onPlayProject={projectActions.playFromBrowser}
        playState={playState}
        projectConfigError={projectConfigError}
        projectConfigSnapshot={projectConfigSnapshot}
        projectKey={project}
        filesystemEventVersion={filesystemEventVersion}
        hasHealthyRuntimeProcess={hasHealthyRuntimeProcess}
        selectedEditorFilePath={selectedEditorFilePath}
        workspaceMode={workspaceMode}
        isProjectConfigLoading={isProjectConfigLoading}
      />
    </div>
  );
}

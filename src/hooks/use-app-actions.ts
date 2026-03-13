import { useCallback } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { WorkspaceController } from "@/hooks/use-workspace-controller";
import type { WorkspaceControllerState } from "@/lib/controller";
import {
  buildWorkspaceLocation,
  type WorkspaceSearch,
} from "@/lib/workspace-navigation";

function normalizeWorkspaceSearch(search: {
  view?: string;
  terminalId?: string;
}): WorkspaceSearch {
  const view = search.view;
  return {
    view:
      view === "browser" ||
      view === "editor" ||
      view === "terminal" ||
      view === "settings"
        ? view
        : "browser",
    terminalId: typeof search.terminalId === "string" ? search.terminalId : undefined,
  };
}

export function useAppActions(
  controller: WorkspaceController,
  state: WorkspaceControllerState
) {
  const navigate = useNavigate();
  const currentRoute = useRouterState({
    select: (s) => {
      const matches = s.matches;
      const last = matches[matches.length - 1];
      return {
        routeId: last?.routeId,
        params: last?.params as { project?: string } | undefined,
        search: (last?.search ?? {}) as { view?: string; terminalId?: string },
      };
    },
  });

  const navigateToProject = useCallback(
    (project: string, search: WorkspaceSearch) => {
      void navigate(buildWorkspaceLocation(project, search));
    },
    [navigate]
  );

  const renameProject = useCallback(
    async (oldName: string, newName: string) => {
      const resolvedName = await controller.renameProject(oldName, newName);
      const nextSearch =
        currentRoute.routeId === "/workspace/$project" &&
        currentRoute.params?.project === oldName
          ? normalizeWorkspaceSearch(currentRoute.search)
          : ({ view: "browser" } as WorkspaceSearch);
      navigateToProject(resolvedName, nextSearch);
    },
    [controller, currentRoute, navigateToProject]
  );

  const reorderProjects = useCallback(
    (reordered: string[]) => {
      controller.reorderProjects(reordered);
    },
    [controller]
  );

  const selectBrowser = useCallback(
    (project: string) => {
      controller.selectProject(project);
      navigateToProject(project, { view: "browser" });
    },
    [controller, navigateToProject]
  );

  const selectTerminal = useCallback(
    (project: string, terminalId: string) => {
      controller.selectProject(project);
      navigateToProject(project, { view: "terminal", terminalId });
    },
    [controller, navigateToProject]
  );

  const createTerminal = useCallback(
    (project: string) => {
      const descriptor = controller.createTerminalSession(project);
      controller.selectProject(project);
      navigateToProject(project, {
        view: "terminal",
        terminalId: descriptor.terminalId,
      });
    },
    [controller, navigateToProject]
  );

  const play = useCallback(
    (project: string) => {
      void controller
        .playProject(project)
        .then(() => {
          controller.selectProject(project);
          const playState =
            controller.getState().playStateByProject[project] ?? "idle";
          if (playState === "failed") return;
          navigateToProject(project, { view: "browser" });
        })
        .catch(() => undefined);
    },
    [controller, navigateToProject]
  );

  const stop = useCallback(
    (project: string) => {
      controller.stopProject(project);
    },
    [controller]
  );

  const toggleShowArchived = useCallback(() => {
    controller.toggleShowArchived();
  }, [controller]);

  const unarchiveProject = useCallback(
    async (project: string) => {
      await controller.unarchiveProject(project);
      navigateToProject(project, { view: "browser" });
    },
    [controller, navigateToProject]
  );

  const renameTerminal = useCallback(
    (terminalId: string, newLabel: string) => {
      controller.renameTerminalSession(terminalId, newLabel);
    },
    [controller]
  );

  const removeTerminal = useCallback(
    (terminalId: string) => {
      controller.removeTerminalSession(terminalId);
    },
    [controller]
  );

  return {
    archivedProjects: state.archivedProjects,
    createTerminal,
    play,
    projects: state.projects,
    removeTerminal,
    renameProject,
    renameTerminal,
    reorderProjects,
    selectBrowser,
    selectTerminal,
    showArchived: state.showArchived,
    stop,
    toggleShowArchived,
    terminalSessionsByProject: state.terminalSessionsByProject,
    playErrorByProject: state.playErrorByProject,
    playStateByProject: state.playStateByProject,
    unarchiveProject,
  };
}

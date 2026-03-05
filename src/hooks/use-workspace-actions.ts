import { useCallback, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import type { WorkspaceController } from "@/hooks/use-workspace-controller";
import type {
  CreateProjectInput,
  WorkspaceControllerState,
} from "@/lib/controller";

type WorkspaceSearchUpdate = {
  view: "browser" | "editor" | "terminal" | "settings";
  terminalId?: string;
};

type NavigateFn = (opts: { search: WorkspaceSearchUpdate }) => void;

export function useWorkspaceActions(
  controller: WorkspaceController,
  state: WorkspaceControllerState
) {
  const navigate = useNavigate();
  const currentSearch = useRouterState({
    select: (s) => {
      const matches = s.matches;
      const last = matches[matches.length - 1];
      return (last?.search ?? {}) as { view?: string; terminalId?: string };
    },
  });
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [isArchivingProject, setIsArchivingProject] = useState(false);

  const createProject = useCallback(
    async (input: CreateProjectInput) => {
      if (isCreatingProject) return;
      setIsCreatingProject(true);
      try {
        const created = await controller.createProject(input);
        void navigate({
          to: "/workspace/$project",
          params: { project: created },
          search: { view: "browser" },
        });
      } finally {
        setIsCreatingProject(false);
      }
    },
    [controller, isCreatingProject, navigate]
  );

  const deleteProject = useCallback(
    async (project: string) => {
      if (isDeletingProject) return;
      setIsDeletingProject(true);
      try {
        await controller.deleteProject(project);
        const remaining = state.projects.filter((p) => p !== project);
        if (remaining.length > 0) {
          void navigate({
            to: "/workspace/$project",
            params: { project: remaining[0]! },
            search: { view: "browser" },
          });
        } else {
          void navigate({ to: "/settings" });
        }
      } finally {
        setIsDeletingProject(false);
      }
    },
    [controller, isDeletingProject, navigate, state.projects]
  );

  const archiveProject = useCallback(
    async (project: string) => {
      if (isArchivingProject) return;
      setIsArchivingProject(true);
      try {
        await controller.archiveProject(project);
        const remaining = state.projects.filter((p) => p !== project);
        if (remaining.length > 0) {
          void navigate({
            to: "/workspace/$project",
            params: { project: remaining[0]! },
            search: { view: "browser" },
          });
        } else {
          void navigate({ to: "/settings" });
        }
      } finally {
        setIsArchivingProject(false);
      }
    },
    [controller, isArchivingProject, navigate, state.projects]
  );

  const unarchiveProject = useCallback(
    async (project: string) => {
      await controller.unarchiveProject(project);
      void navigate({
        to: "/workspace/$project",
        params: { project },
        search: { view: "browser" },
      });
    },
    [controller, navigate]
  );

  const renameProject = useCallback(
    async (oldName: string, newName: string) => {
      const resolvedName = await controller.renameProject(oldName, newName);
      void navigate({
        to: "/workspace/$project",
        params: { project: resolvedName },
        search: {
          view: (currentSearch.view as "browser" | "editor" | "terminal" | "settings") ?? "browser",
          terminalId: currentSearch.terminalId,
        },
      });
    },
    [controller, navigate, currentSearch]
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
      void navigate({
        to: "/workspace/$project",
        params: { project },
        search: { view: "browser" },
      });
    },
    [controller, navigate]
  );

  const selectTerminal = useCallback(
    (project: string, terminalId: string) => {
      controller.selectProject(project);
      void navigate({
        to: "/workspace/$project",
        params: { project },
        search: { view: "terminal", terminalId },
      });
    },
    [controller, navigate]
  );

  const createTerminal = useCallback(
    (project: string) => {
      const descriptor = controller.createTerminalSession(project);
      controller.selectProject(project);
      void navigate({
        to: "/workspace/$project",
        params: { project },
        search: { view: "terminal", terminalId: descriptor.terminalId },
      });
    },
    [controller, navigate]
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
          void navigate({
            to: "/workspace/$project",
            params: { project },
            search: { view: "browser" },
          });
        })
        .catch(() => undefined);
    },
    [controller, navigate]
  );

  const playFromBrowser = useCallback(
    (project: string) => {
      void controller
        .playProject(project)
        .then(() => {
          controller.selectProject(project);
        })
        .catch(() => undefined);
    },
    [controller]
  );

  const playFromSettings = useCallback(
    async (project: string) => {
      try {
        await controller.playProject(project);
      } catch {
        // Failed state/error text is synchronized via workspace controller state.
      }
    },
    [controller]
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

  const workspaceModeChange = useCallback(
    (project: string, navigateFn: NavigateFn, mode: "browser" | "editor" | "agent" | "settings") => {
      if (mode === "browser") {
        void navigateFn({ search: { view: "browser" } });
        return;
      }
      if (mode === "editor") {
        void navigateFn({ search: { view: "editor" } });
        return;
      }
      if (mode === "settings") {
        void navigateFn({ search: { view: "settings" } });
        return;
      }
      // agent
      const agentId =
        controller.getAgentTerminalId(project) ??
        controller.ensureAgentTerminalSession(project);
      void navigateFn({ search: { view: "terminal", terminalId: agentId } });
    },
    [controller]
  );

  const elementGrabbed = useCallback(
    (
      project: string,
      navigateFn: NavigateFn,
      data: {
        tag: string;
        id: string;
        className: string;
        text: string;
        selector: string;
        outerHTML?: string;
      }
    ) => {
      controller.selectProject(project);

      const agentTerminalId =
        controller.getAgentTerminalId(project) ??
        controller.ensureAgentTerminalSession(project);
      void navigateFn({
        search: { view: "terminal", terminalId: agentTerminalId },
      });

      const tagPart =
        data.tag +
        (data.id ? `#${data.id}` : "") +
        (data.className
          ? `.${data.className.trim().split(/\s+/).join(".")}`
          : "");
      const textSnippet = data.text ? data.text.slice(0, 200) : "";
      const htmlSnippet = data.outerHTML ? data.outerHTML.slice(0, 500) : "";
      const formatted = [
        "",
        `DOM node selected: <${tagPart}>`,
        `selector: ${data.selector}`,
        textSnippet ? `text: ${textSnippet}` : null,
        htmlSnippet ? `html: ${htmlSnippet}` : null,
        "",
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n");

      void invoke("terminal_write", {
        terminalId: agentTerminalId,
        data: formatted,
      }).catch(() => undefined);
    },
    [controller]
  );

  return {
    isCreatingProject,
    isDeletingProject,
    isArchivingProject,
    createProject,
    deleteProject,
    archiveProject,
    unarchiveProject,
    renameProject,
    reorderProjects,
    selectBrowser,
    selectTerminal,
    createTerminal,
    play,
    playFromBrowser,
    playFromSettings,
    stop,
    toggleShowArchived,
    workspaceModeChange,
    elementGrabbed,
  };
}

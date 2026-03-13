import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import type { WorkspaceController } from "@/hooks/use-workspace-controller";
import type { WorkspaceControllerState } from "@/lib/controller";
import {
  buildWorkspaceLocation,
  type WorkspaceSearch,
} from "@/lib/workspace-navigation";

type ProjectWorkspaceMode = "browser" | "editor" | "agent" | "settings";

type GrabbedElement = {
  tag: string;
  id: string;
  className: string;
  text: string;
  selector: string;
  outerHTML?: string;
};

export function useProjectActions(
  controller: WorkspaceController,
  state: WorkspaceControllerState,
  project: string
) {
  const navigate = useNavigate();
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [isArchivingProject, setIsArchivingProject] = useState(false);

  const navigateWithinProject = useCallback(
    (search: WorkspaceSearch) => {
      void navigate(buildWorkspaceLocation(project, search));
    },
    [navigate, project]
  );

  const workspaceModeChange = useCallback(
    (mode: ProjectWorkspaceMode) => {
      if (mode === "browser") {
        navigateWithinProject({ view: "browser" });
        return;
      }
      if (mode === "editor") {
        navigateWithinProject({ view: "editor" });
        return;
      }
      if (mode === "settings") {
        navigateWithinProject({ view: "settings" });
        return;
      }
      const agentId =
        controller.getAgentTerminalId(project) ??
        controller.ensureAgentTerminalSession(project);
      navigateWithinProject({ view: "terminal", terminalId: agentId });
    },
    [controller, navigateWithinProject, project]
  );

  const elementGrabbed = useCallback(
    (data: GrabbedElement) => {
      const agentTerminalId =
        controller.getAgentTerminalId(project) ??
        controller.ensureAgentTerminalSession(project);
      navigateWithinProject({
        view: "terminal",
        terminalId: agentTerminalId,
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
    [controller, navigateWithinProject, project]
  );

  const playFromBrowser = useCallback(() => {
    void controller.playProject(project).catch(() => undefined);
  }, [controller, project]);

  const playFromSettings = useCallback(async () => {
    try {
      await controller.playProject(project);
    } catch {
      // Failed state/error text is synchronized via workspace controller state.
    }
  }, [controller, project]);

  const stop = useCallback(() => {
    controller.stopProject(project);
  }, [controller, project]);

  const deleteProject = useCallback(async () => {
    if (isDeletingProject) return;
    setIsDeletingProject(true);
    try {
      await controller.deleteProject(project);
      const remaining = state.projects.filter((candidate) => candidate !== project);
      if (remaining.length > 0) {
        void navigate(buildWorkspaceLocation(remaining[0]!, { view: "browser" }));
      } else {
        void navigate({ to: "/settings" });
      }
    } finally {
      setIsDeletingProject(false);
    }
  }, [controller, isDeletingProject, navigate, project, state.projects]);

  const archiveProject = useCallback(async () => {
    if (isArchivingProject) return;
    setIsArchivingProject(true);
    try {
      await controller.archiveProject(project);
      const remaining = state.projects.filter((candidate) => candidate !== project);
      if (remaining.length > 0) {
        void navigate(buildWorkspaceLocation(remaining[0]!, { view: "browser" }));
      } else {
        void navigate({ to: "/settings" });
      }
    } finally {
      setIsArchivingProject(false);
    }
  }, [controller, isArchivingProject, navigate, project, state.projects]);

  return {
    archiveProject,
    deleteProject,
    elementGrabbed,
    isArchivingProject,
    isDeletingProject,
    playFromBrowser,
    playFromSettings,
    stop,
    workspaceModeChange,
  };
}

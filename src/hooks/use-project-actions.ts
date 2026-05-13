import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import type { WorkspaceController } from "@/hooks/use-workspace-controller";
import type { WorkspaceControllerState } from "@/lib/controller";
import { terminalRegistry } from "@/lib/terminal-registry";
import {
  applyAgentLaunchStrategy,
  createAgentInstanceId,
  createAgentSessionId,
  defaultAgentProfile,
} from "@/lib/controller/agent-profiles";
import { runRegisteredPreviewCapturer } from "@/lib/project-preview";
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

  const selectTerminal = useCallback(
    (terminalId: string) => {
      navigateWithinProject({ view: "terminal", terminalId });
    },
    [navigateWithinProject]
  );

  const createTerminal = useCallback(() => {
    const descriptor = controller.createTerminalSession(project);
    navigateWithinProject({
      view: "terminal",
      terminalId: descriptor.terminalId,
    });
  }, [controller, navigateWithinProject, project]);

  const createAgentTerminal = useCallback(() => {
    const profile = defaultAgentProfile(state.agentSettings);
    const agentLaunch = {
      profileId: profile.id,
      instanceId: createAgentInstanceId(project, profile.id),
      provider: profile.provider,
      sessionId:
        profile.sessionIdStrategy === "preseed-uuid"
          ? createAgentSessionId()
          : null,
      command: profile.command,
    };
    const descriptor = controller.createTerminalSession(project, profile.label, {
      processRole: "agent",
      agentLaunch,
    });
    void terminalRegistry
      .acquire(descriptor.terminalId, project, {
        processRole: "agent",
        agentLaunch,
      })
      .then(() => terminalRegistry.openPty(descriptor.terminalId))
      .then(() => {
        terminalRegistry.sendCommand(
          descriptor.terminalId,
          applyAgentLaunchStrategy(
            profile.command,
            profile,
            agentLaunch.sessionId,
          ),
        );
      })
      .catch(() => undefined);
    navigateWithinProject({
      view: "terminal",
      terminalId: descriptor.terminalId,
    });
  }, [controller, navigateWithinProject, project, state.agentSettings]);

  const commitCurrentChanges = useCallback(
    (changedFilePaths: readonly string[] = []) => {
      const profile = defaultAgentProfile(state.agentSettings);
      const agentLaunch = {
        profileId: profile.id,
        instanceId: createAgentInstanceId(project, profile.id),
        provider: profile.provider,
        sessionId:
          profile.sessionIdStrategy === "preseed-uuid"
            ? createAgentSessionId()
            : null,
        command: profile.command,
      };
      const descriptor = controller.createTerminalSession(project, "Commit", {
        processRole: "agent",
        agentLaunch,
      });
      const visiblePaths = changedFilePaths.slice(0, 40);
      const remainingCount = Math.max(
        0,
        changedFilePaths.length - visiblePaths.length,
      );
      const fileList =
        visiblePaths.length > 0
          ? [
              "",
              "Changed files currently visible in the editor:",
              ...visiblePaths.map((path) => `- ${path}`),
              remainingCount > 0 ? `- ...and ${remainingCount} more` : null,
            ]
              .filter((line): line is string => line !== null)
              .join("\n")
          : "";
      const prompt = [
        "Please inspect the current git changes in this project, stage the appropriate files, " +
          "create a concise commit message, and commit the current changes. Do not push.",
        fileList,
      ]
        .filter(Boolean)
        .join("\n");

      void terminalRegistry
        .acquire(descriptor.terminalId, project, {
          processRole: "agent",
          agentLaunch,
        })
        .then(() => terminalRegistry.openPty(descriptor.terminalId))
        .then(() => {
          terminalRegistry.sendCommand(
            descriptor.terminalId,
            applyAgentLaunchStrategy(
              profile.command,
              profile,
              agentLaunch.sessionId,
            ),
          );
          window.setTimeout(() => {
            terminalRegistry.sendCommand(descriptor.terminalId, prompt);
          }, 900);
        })
        .catch(() => undefined);
      navigateWithinProject({
        view: "terminal",
        terminalId: descriptor.terminalId,
      });
    },
    [controller, navigateWithinProject, project, state.agentSettings],
  );

  const removeTerminal = useCallback(
    (terminalId: string) => {
      controller.removeTerminalSession(terminalId);
    },
    [controller]
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

  const restartAppFromBrowser = useCallback(() => {
    void controller.restartAppProcesses(project).catch(() => undefined);
  }, [controller, project]);

  const playFromSettings = useCallback(async () => {
    try {
      await controller.playProject(project);
    } catch {
      // Failed state/error text is synchronized via workspace controller state.
    }
  }, [controller, project]);

  const stop = useCallback(() => {
    void runRegisteredPreviewCapturer(project).finally(() => {
      controller.stopProject(project);
    });
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
        void navigate({ to: "/settings", search: { tab: "basic" } });
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
        void navigate({ to: "/settings", search: { tab: "basic" } });
      }
    } finally {
      setIsArchivingProject(false);
    }
  }, [controller, isArchivingProject, navigate, project, state.projects]);

  return {
    archiveProject,
    createAgentTerminal,
    createTerminal,
    commitCurrentChanges,
    deleteProject,
    elementGrabbed,
    isArchivingProject,
    isDeletingProject,
    playFromBrowser,
    playFromSettings,
    restartAppFromBrowser,
    removeTerminal,
    selectTerminal,
    stop,
    workspaceModeChange,
  };
}

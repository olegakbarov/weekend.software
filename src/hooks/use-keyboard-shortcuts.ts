import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { WorkspaceController } from "@/hooks/use-workspace-controller";

export function useKeyboardShortcuts(
  controller: WorkspaceController,
  currentProject: string | null,
  currentView: string | null,
  onToggleSidebar?: () => void
) {
  const navigate = useNavigate();

  const switchWorkspaceModeRef = useRef<
    (mode: "browser" | "editor" | "agent") => void
  >(() => undefined);

  useEffect(() => {
    switchWorkspaceModeRef.current = (
      mode: "browser" | "editor" | "agent"
    ) => {
      if (!currentProject) return;

      if (mode === "browser") {
        void navigate({
          to: "/workspace/$project",
          params: { project: currentProject },
          search: { view: "browser" },
        });
        return;
      }

      if (mode === "editor") {
        void navigate({
          to: "/workspace/$project",
          params: { project: currentProject },
          search: { view: "editor" },
        });
        return;
      }

      // agent
      const agentId =
        controller.getAgentTerminalId(currentProject) ??
        controller.ensureAgentTerminalSession(currentProject);
      void navigate({
        to: "/workspace/$project",
        params: { project: currentProject },
        search: { view: "terminal", terminalId: agentId },
      });
    };
  }, [controller, currentProject, navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      switch (e.key.toLowerCase()) {
        case "n":
          e.preventDefault();
          void navigate({ to: "/home" });
          break;
        case "j":
          e.preventDefault();
          switchWorkspaceModeRef.current("browser");
          break;
        case "k":
          e.preventDefault();
          switchWorkspaceModeRef.current("agent");
          break;
        case "l":
          e.preventDefault();
          switchWorkspaceModeRef.current("editor");
          break;
        case "b":
          e.preventDefault();
          onToggleSidebar?.();
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, onToggleSidebar]);
}

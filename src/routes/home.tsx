import { useCallback, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/home/home-page";
import type { CreateProjectInput } from "@/lib/controller";
import { useWorkspaceState } from "@/hooks/use-workspace-state";

export const Route = createFileRoute("/home")({
  component: HomeRoute,
});

function HomeRoute() {
  const { controller } = Route.useRouteContext();
  const state = useWorkspaceState(controller);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const navigate = Route.useNavigate();

  const createProject = useCallback(
    async (input: CreateProjectInput) => {
      if (isCreatingProject) return;
      setIsCreatingProject(true);
      try {
        const created = await controller.createProject(input);
        const agentTerminalId =
          controller.getAgentTerminalId(created) ??
          controller.ensureAgentTerminalSession(created);
        void navigate({
          to: "/workspace/$project",
          params: { project: created },
          search: { view: "terminal", terminalId: agentTerminalId },
        });
      } finally {
        setIsCreatingProject(false);
      }
    },
    [controller, isCreatingProject, navigate]
  );

  return (
    <HomePage
      agentSettings={state.agentSettings}
      isCreatingProject={isCreatingProject}
      onCreateProject={createProject}
    />
  );
}

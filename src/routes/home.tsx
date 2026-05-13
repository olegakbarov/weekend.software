import { useCallback, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  HomePage,
  type CreateProjectFromPresetInput,
} from "@/components/home/home-page";
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

  const navigateToCreated = useCallback(
    (created: string) => {
      const agentTerminalId =
        controller.getAgentTerminalId(created) ??
        controller.ensureAgentTerminalSession(created);
      void navigate({
        to: "/workspace/$project",
        params: { project: created },
        search: { view: "terminal", terminalId: agentTerminalId },
      });
    },
    [controller, navigate],
  );

  const createProject = useCallback(
    async (input: CreateProjectInput) => {
      if (isCreatingProject) return;
      setIsCreatingProject(true);
      try {
        const created = await controller.createProject(input);
        navigateToCreated(created);
      } finally {
        setIsCreatingProject(false);
      }
    },
    [controller, isCreatingProject, navigateToCreated],
  );

  const createFromPreset = useCallback(
    async (input: CreateProjectFromPresetInput) => {
      if (isCreatingProject) return;
      setIsCreatingProject(true);
      try {
        const created = await controller.createProjectFromPreset({
          name: input.name,
          presetId: input.presetId,
          fieldValues: input.fieldValues,
          defaultAgentProfileId: input.defaultAgentProfileId,
          defaultAgentCommand: input.defaultAgentCommand,
          initialPrompt: input.initialPrompt,
          additionalFileWrites: input.additionalFileWrites,
        });
        navigateToCreated(created);
      } finally {
        setIsCreatingProject(false);
      }
    },
    [controller, isCreatingProject, navigateToCreated],
  );

  return (
    <HomePage
      agentSettings={state.agentSettings}
      isCreatingProject={isCreatingProject}
      onCreateProject={createProject}
      onCreateFromPreset={createFromPreset}
    />
  );
}

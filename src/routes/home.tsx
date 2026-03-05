import { useCallback, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/home/home-page";
import type { CreateProjectInput } from "@/lib/controller";

export const Route = createFileRoute("/home")({
  component: HomeRoute,
});

function HomeRoute() {
  const { controller } = Route.useRouteContext();
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const navigate = Route.useNavigate();

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

  return (
    <HomePage
      isCreatingProject={isCreatingProject}
      onCreateProject={createProject}
    />
  );
}

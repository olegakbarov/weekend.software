import { useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useWorkspaceState } from "@/hooks/use-workspace-state";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const { controller } = Route.useRouteContext();
  const state = useWorkspaceState(controller);
  const navigate = useNavigate();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (hasRedirectedRef.current) return;

    if (state.projects.length > 0) {
      hasRedirectedRef.current = true;
      void navigate({
        to: "/workspace/$project",
        params: { project: state.projects[0]! },
        search: { view: "browser" },
        replace: true,
      });
      return;
    }

    if (state.initialized) {
      hasRedirectedRef.current = true;
      void navigate({ to: "/home", replace: true });
    }
  }, [state.projects, state.initialized, navigate]);

  return null;
}

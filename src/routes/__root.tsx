import {
  createRootRouteWithContext,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Sidebar } from "@/components/sidebar/sidebar";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import type { WorkspaceController } from "@/hooks/use-workspace-controller";
import { useWorkspaceState } from "@/hooks/use-workspace-state";
import { cn } from "@/lib/utils";

const FULLSCREEN_SIDEBAR_EDGE_TRIGGER_WIDTH_PX = 3;
const FULLSCREEN_SIDEBAR_WIDTH_PX = 260;

export type RouterContext = {
  controller: WorkspaceController;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function useCurrentRouteInfo() {
  return useRouterState({
    select: (s) => {
      const matches = s.matches;
      const last = matches[matches.length - 1];
      const routeId = last?.routeId;
      const params = last?.params as { project?: string } | undefined;
      const search = last?.search as {
        view?: string;
        terminalId?: string;
      } | undefined;

      let route: "home" | "settings" | "logs" | "workspace" | "index" = "index";
      if (routeId === "/workspace/$project") route = "workspace";
      else if (routeId === "/home") route = "home";
      else if (routeId === "/settings") route = "settings";
      else if (routeId === "/logs") route = "logs";

      return {
        route,
        project: params?.project ?? null,
        view: search?.view ?? null,
        terminalId: search?.terminalId ?? null,
      };
    },
  });
}

function RootLayout() {
  const { controller } = Route.useRouteContext();
  const state = useWorkspaceState(controller);
  const navigate = useNavigate();
  const { isFullscreen, isSidebarVisible, setIsSidebarVisible } =
    useFullscreen();
  const actions = useWorkspaceActions(controller, state);
  const routeInfo = useCurrentRouteInfo();

  useKeyboardShortcuts(controller, routeInfo.project, routeInfo.route === "workspace" ? routeInfo.view : null);

  const sidebar = (
    <Sidebar
      currentProject={routeInfo.project}
      currentRoute={routeInfo.route}
      activeTerminalId={routeInfo.view === "terminal" ? routeInfo.terminalId : null}
      isFullscreen={isFullscreen}
      onCreateTerminal={actions.createTerminal}
      onOpenLogs={() => void navigate({ to: "/logs" })}
      onOpenSettings={() => void navigate({ to: "/settings" })}
      onRenameTerminal={(terminalId, newLabel) => {
        controller.renameTerminalSession(terminalId, newLabel);
      }}
      onPlay={actions.play}
      onStop={actions.stop}
      onRemoveTerminal={(terminalId) => {
        controller.removeTerminalSession(terminalId);
      }}
      onReorderProjects={actions.reorderProjects}
      onRenameProject={actions.renameProject}
      onSelectBrowser={actions.selectBrowser}
      onSelectTerminal={actions.selectTerminal}
      playStateByProject={state.playStateByProject}
      playErrorByProject={state.playErrorByProject}
      projects={state.projects}
      terminalSessionsByProject={state.terminalSessionsByProject}
      showArchived={state.showArchived}
      archivedProjects={state.archivedProjects}
      onToggleShowArchived={actions.toggleShowArchived}
      onUnarchiveProject={actions.unarchiveProject}
    />
  );

  return (
    <div className="relative flex h-screen flex-row bg-background text-foreground">
      {isFullscreen ? (
        <>
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 z-40"
            onMouseEnter={() => {
              setIsSidebarVisible(true);
            }}
            style={{ width: `${FULLSCREEN_SIDEBAR_EDGE_TRIGGER_WIDTH_PX}px` }}
          />
          <div
            className={cn(
              "relative z-50 h-full shrink-0 overflow-hidden transition-[width] duration-150 ease-out"
            )}
            style={{
              width: isSidebarVisible
                ? `${FULLSCREEN_SIDEBAR_WIDTH_PX}px`
                : "0px",
            }}
            onMouseLeave={() => {
              setIsSidebarVisible(false);
            }}
          >
            <div
              className="h-full"
              style={{ width: `${FULLSCREEN_SIDEBAR_WIDTH_PX}px` }}
            >
              {sidebar}
            </div>
          </div>
        </>
      ) : (
        sidebar
      )}
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <ErrorBoundary name="root-outlet">
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}

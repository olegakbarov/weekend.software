import {
  createRootRouteWithContext,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Sidebar } from "@/components/sidebar/sidebar";
import {
  SidebarProvider,
  type SidebarData,
  type SidebarActions,
} from "@/components/sidebar/sidebar-context";
import {
  SIDEBAR_WIDTH_PX,
  SIDEBAR_EDGE_TRIGGER_PX,
} from "@/components/sidebar/sidebar-constants";
import { useAppActions } from "@/hooks/use-app-actions";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { useSidebarVisibility } from "@/hooks/use-sidebar-visibility";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import type { WorkspaceController } from "@/hooks/use-workspace-controller";
import { setTrafficLightsVisible } from "@/lib/tauri-mock";
import { useWorkspaceState } from "@/hooks/use-workspace-state";
import { cn } from "@/lib/utils";

export type RouterContext = {
  controller: WorkspaceController;
};

type CurrentRouteInfo = {
  route:
    | "home"
    | "settings"
    | "logs"
    | "workspace"
    | "index"
    | "shared-drop";
  project: string | null;
  view: string | null;
  terminalId: string | null;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function useCurrentRouteInfo(): CurrentRouteInfo {
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

      let route: CurrentRouteInfo["route"] = "index";
      if (routeId === "/workspace/$project") route = "workspace";
      else if (routeId === "/home") route = "home";
      else if (routeId === "/settings") route = "settings";
      else if (routeId === "/logs") route = "logs";
      else if (routeId === "/shared-drop") route = "shared-drop";

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
  const routeInfo = useCurrentRouteInfo();

  if (routeInfo.route === "shared-drop") {
    return (
      <main className="h-screen overflow-hidden bg-transparent text-foreground">
        <ErrorBoundary name="shared-drop-outlet">
          <Outlet />
        </ErrorBoundary>
      </main>
    );
  }

  return <WorkspaceRootLayout routeInfo={routeInfo} />;
}

function WorkspaceRootLayout({ routeInfo }: { routeInfo: CurrentRouteInfo }) {
  const { controller } = Route.useRouteContext();
  const state = useWorkspaceState(controller);
  const navigate = useNavigate();
  const isFullscreen = useFullscreen();
  const { isSidebarVisible, setIsSidebarVisible, isSidebarCollapsed, toggleSidebarCollapsed } =
    useSidebarVisibility(isFullscreen);
  const appActions = useAppActions(controller, state);
  const shouldShowTrafficLights = !isFullscreen && !isSidebarCollapsed;

  useKeyboardShortcuts(
    controller,
    routeInfo.project,
    routeInfo.route === "workspace" ? routeInfo.view : null,
    toggleSidebarCollapsed,
  );

  useEffect(() => {
    void setTrafficLightsVisible(shouldShowTrafficLights).catch(() => undefined);
  }, [shouldShowTrafficLights]);

  const sidebarData: SidebarData = {
    currentProject: routeInfo.project,
    currentRoute: routeInfo.route,
    activeTerminalId: routeInfo.view === "terminal" ? routeInfo.terminalId : null,
    isFullscreen,
    projects: appActions.projects,
    terminalSessionsByProject: appActions.terminalSessionsByProject,
    playStateByProject: appActions.playStateByProject,
    playErrorByProject: appActions.playErrorByProject,
    showArchived: appActions.showArchived,
    archivedProjects: appActions.archivedProjects,
  };

  const sidebarActions: SidebarActions = useMemo(
    () => ({
      onOpenHome: () => void navigate({ to: "/home" }),
      onCreateTerminal: appActions.createTerminal,
      onOpenLogs: () => void navigate({ to: "/logs" }),
      onOpenSettings: () => void navigate({ to: "/settings" }),
      onRenameTerminal: appActions.renameTerminal,
      onPlay: appActions.play,
      onStop: appActions.stop,
      onRemoveTerminal: appActions.removeTerminal,
      onReorderProjects: appActions.reorderProjects,
      onRenameProject: appActions.renameProject,
      onSelectBrowser: appActions.selectBrowser,
      onSelectTerminal: appActions.selectTerminal,
      onToggleShowArchived: appActions.toggleShowArchived,
      onUnarchiveProject: appActions.unarchiveProject,
      onToggleSidebar: toggleSidebarCollapsed,
    }),
    [appActions, navigate, toggleSidebarCollapsed],
  );

  const sidebar = (
    <SidebarProvider data={sidebarData} actions={sidebarActions}>
      <Sidebar />
    </SidebarProvider>
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
            style={{ width: `${SIDEBAR_EDGE_TRIGGER_PX}px` }}
          />
          <div
            className={cn(
              "relative z-50 h-full shrink-0 overflow-hidden transition-[width] duration-150 ease-out"
            )}
            style={{
              width: isSidebarVisible
                ? `${SIDEBAR_WIDTH_PX}px`
                : "0px",
            }}
            onMouseLeave={() => {
              setIsSidebarVisible(false);
            }}
          >
            <div
              className="h-full"
              style={{ width: `${SIDEBAR_WIDTH_PX}px` }}
            >
              {sidebar}
            </div>
          </div>
        </>
      ) : (
        <div
          className="relative h-full shrink-0 overflow-hidden transition-[width] duration-150 ease-out"
          style={{
            width: isSidebarCollapsed ? "0px" : `${SIDEBAR_WIDTH_PX}px`,
          }}
        >
          <div
            className="h-full"
            style={{ width: `${SIDEBAR_WIDTH_PX}px` }}
          >
            {sidebar}
          </div>
        </div>
      )}
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <ErrorBoundary name="root-outlet">
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}

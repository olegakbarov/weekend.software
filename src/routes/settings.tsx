import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/settings/settings-page";
import {
  isSettingsTab,
  type SettingsTab,
} from "@/components/settings/settings-tabs";
import { useLogs } from "@/hooks/use-logs";
import { useVimMode } from "@/hooks/use-vim-mode";
import { useWorkspaceState } from "@/hooks/use-workspace-state";

type SettingsSearch = { tab: SettingsTab };

export const Route = createFileRoute("/settings")({
  validateSearch: (search: Record<string, unknown>): SettingsSearch => {
    const tab = search.tab;
    return { tab: isSettingsTab(tab) ? tab : "basic" };
  },
  component: SettingsRoute,
});

function SettingsRoute() {
  const { controller } = Route.useRouteContext();
  const state = useWorkspaceState(controller);
  const { tab } = Route.useSearch();
  const [isVimModeEnabled, setIsVimModeEnabled] = useVimMode();
  const [isRefreshingRuntimeSnapshot, setIsRefreshingRuntimeSnapshot] =
    useState(false);
  const { weekendLogsSnapshot, isRefreshing: isLogsRefreshing, error: logsError, refresh: refreshLogs } = useLogs();

  useEffect(() => {
    refreshLogs();
  }, [refreshLogs]);

  const refreshRuntimeSnapshot = useCallback(() => {
    if (isRefreshingRuntimeSnapshot) return;
    setIsRefreshingRuntimeSnapshot(true);
    void controller
      .refreshRuntimeSnapshot()
      .catch(() => undefined)
      .finally(() => {
        setIsRefreshingRuntimeSnapshot(false);
      });
  }, [isRefreshingRuntimeSnapshot, controller]);

  const handleShowArchivedAppsChange = useCallback(
    (enabled: boolean) => {
      if (enabled !== state.showArchived) {
        controller.toggleShowArchived();
      }
    },
    [controller, state.showArchived]
  );

  const refreshSharedAssets = useCallback(() => {
    void controller.refreshSharedAssets().catch(() => undefined);
  }, [controller]);

  const handleUploadSharedAssets = useCallback(
    async (files: File[]) => {
      await controller.uploadSharedAssets(files);
    },
    [controller]
  );

  const handleRenameSharedAsset = useCallback(
    async (fileName: string, newFileName: string) => {
      await controller.renameSharedAsset(fileName, newFileName);
    },
    [controller]
  );

  const handleDeleteSharedAsset = useCallback(
    async (fileName: string) => {
      await controller.deleteSharedAsset(fileName);
    },
    [controller]
  );

  const handleUpdateSharedEnv = useCallback(
    async (env: Record<string, string>) => {
      await controller.updateSharedEnv(env);
    },
    [controller]
  );

  return (
    <SettingsPage
      activeTab={tab}
      error={state.runtimeDebugError}
      isRefreshing={isRefreshingRuntimeSnapshot}
      isVimModeEnabled={isVimModeEnabled}
      onVimModeEnabledChange={setIsVimModeEnabled}
      showArchivedApps={state.showArchived}
      onShowArchivedAppsChange={handleShowArchivedAppsChange}
      onRefreshRuntimeSnapshot={refreshRuntimeSnapshot}
      runtimeTelemetryEvents={state.runtimeTelemetryEvents}
      snapshot={state.runtimeDebugSnapshot}
      weekendLogs={weekendLogsSnapshot}
      logsError={logsError}
      isLogsRefreshing={isLogsRefreshing}
      onRefreshLogs={refreshLogs}
      agentSettings={state.agentSettings}
      onAgentSettingsChange={controller.updateAgentSettings}
      sharedAssets={state.sharedAssets}
      sharedAssetsError={state.sharedAssetsError}
      isSharedLoading={state.sharedAssetsLoading}
      isSharedUploading={state.sharedAssetsUploading}
      onRefreshShared={refreshSharedAssets}
      onUploadShared={handleUploadSharedAssets}
      onRenameShared={handleRenameSharedAsset}
      onDeleteShared={handleDeleteSharedAsset}
      sharedEnv={state.sharedEnv}
      onUpdateSharedEnv={handleUpdateSharedEnv}
    />
  );
}

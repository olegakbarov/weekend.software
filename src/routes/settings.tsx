import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/settings/settings-page";
import { useLogs } from "@/hooks/use-logs";
import { useVimMode } from "@/hooks/use-vim-mode";
import { useWorkspaceState } from "@/hooks/use-workspace-state";

export const Route = createFileRoute("/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
  const { controller } = Route.useRouteContext();
  const state = useWorkspaceState(controller);
  const [isVimModeEnabled, setIsVimModeEnabled] = useVimMode();
  const [isRefreshingRuntimeSnapshot, setIsRefreshingRuntimeSnapshot] =
    useState(false);
  const { weekendLogsSnapshot, isRefreshing: isLogsRefreshing, error: logsError, refresh: refreshLogs } = useLogs();

  useEffect(() => {
    void controller.refreshSharedAssets().catch(() => undefined);
    refreshLogs();
  }, [controller, refreshLogs]);

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

  const handleShowArchivedAppsChange = useCallback(
    (enabled: boolean) => {
      if (enabled !== state.showArchived) {
        controller.toggleShowArchived();
      }
    },
    [controller, state.showArchived]
  );

  return (
    <SettingsPage
      error={state.runtimeDebugError}
      isRefreshing={isRefreshingRuntimeSnapshot}
      isSharedAssetsLoading={state.sharedAssetsLoading}
      isSharedAssetsUploading={state.sharedAssetsUploading}
      isVimModeEnabled={isVimModeEnabled}
      onRefreshSharedAssets={refreshSharedAssets}
      onVimModeEnabledChange={setIsVimModeEnabled}
      showArchivedApps={state.showArchived}
      onShowArchivedAppsChange={handleShowArchivedAppsChange}
      onRefreshRuntimeSnapshot={refreshRuntimeSnapshot}
      onUploadSharedAssets={handleUploadSharedAssets}
      onRenameSharedAsset={handleRenameSharedAsset}
      onDeleteSharedAsset={handleDeleteSharedAsset}
      runtimeTelemetryEvents={state.runtimeTelemetryEvents}
      sharedAssets={state.sharedAssets}
      sharedAssetsError={state.sharedAssetsError}
      snapshot={state.runtimeDebugSnapshot}
      weekendLogs={weekendLogsSnapshot}
      logsError={logsError}
      isLogsRefreshing={isLogsRefreshing}
      onRefreshLogs={refreshLogs}
    />
  );
}

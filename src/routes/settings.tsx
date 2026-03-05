import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/settings/settings-page";
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

  useEffect(() => {
    void controller.refreshSharedAssets().catch(() => undefined);
  }, [controller]);

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

  return (
    <SettingsPage
      error={state.runtimeDebugError}
      isRefreshing={isRefreshingRuntimeSnapshot}
      isSharedAssetsLoading={state.sharedAssetsLoading}
      isSharedAssetsUploading={state.sharedAssetsUploading}
      isVimModeEnabled={isVimModeEnabled}
      onRefreshSharedAssets={refreshSharedAssets}
      onVimModeEnabledChange={setIsVimModeEnabled}
      onRefreshRuntimeSnapshot={refreshRuntimeSnapshot}
      onUploadSharedAssets={handleUploadSharedAssets}
      runtimeTelemetryEvents={state.runtimeTelemetryEvents}
      sharedAssets={state.sharedAssets}
      sharedAssetsError={state.sharedAssetsError}
      snapshot={state.runtimeDebugSnapshot}
    />
  );
}

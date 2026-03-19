import { useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SharedPage } from "@/components/shared/shared-page";
import { useWorkspaceState } from "@/hooks/use-workspace-state";

export const Route = createFileRoute("/shared")({
  component: SharedRoute,
});

function SharedRoute() {
  const { controller } = Route.useRouteContext();
  const state = useWorkspaceState(controller);

  const refreshSharedAssets = useCallback(() => {
    void controller.refreshSharedAssets().catch(() => undefined);
  }, [controller]);

  const handleUploadSharedAssets = useCallback(
    async (files: File[]) => {
      await controller.uploadSharedAssets(files);
    },
    [controller],
  );

  const handleRenameSharedAsset = useCallback(
    async (fileName: string, newFileName: string) => {
      await controller.renameSharedAsset(fileName, newFileName);
    },
    [controller],
  );

  const handleDeleteSharedAsset = useCallback(
    async (fileName: string) => {
      await controller.deleteSharedAsset(fileName);
    },
    [controller],
  );

  return (
    <SharedPage
      sharedAssets={state.sharedAssets}
      sharedAssetsError={state.sharedAssetsError}
      isLoading={state.sharedAssetsLoading}
      isUploading={state.sharedAssetsUploading}
      onRefresh={refreshSharedAssets}
      onUpload={handleUploadSharedAssets}
      onRename={handleRenameSharedAsset}
      onDelete={handleDeleteSharedAsset}
    />
  );
}

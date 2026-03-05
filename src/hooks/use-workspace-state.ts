import { useSyncExternalStore } from "react";
import type { WorkspaceController } from "@/hooks/use-workspace-controller";

export function useWorkspaceState(controller: WorkspaceController) {
  return useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState
  );
}

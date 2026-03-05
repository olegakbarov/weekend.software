import { useEffect, useMemo } from "react";
import { createWorkspaceController } from "@/lib/controller";

export type WorkspaceController = ReturnType<typeof createWorkspaceController>;

export function useWorkspaceController(): {
  controller: WorkspaceController;
} {
  const controller = useMemo(() => createWorkspaceController(), []);

  useEffect(() => {
    void controller.init().catch(() => undefined);
    return () => {
      void controller.dispose();
    };
  }, [controller]);

  return { controller };
}

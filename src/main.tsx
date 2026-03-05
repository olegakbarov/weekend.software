import React from "react";
import ReactDOM from "react-dom/client";
import {
  RouterProvider,
  createRouter,
  createHashHistory,
} from "@tanstack/react-router";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { useWorkspaceController } from "@/hooks/use-workspace-controller";
import { initUiFileLogger } from "@/lib/ui-file-logger";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

initUiFileLogger();

const hashHistory = createHashHistory();
const router = createRouter({
  routeTree,
  history: hashHistory,
  context: undefined!,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function InnerApp() {
  const { controller } = useWorkspaceController();
  const context = React.useMemo(() => ({ controller }), [controller]);

  return (
    <RouterProvider router={router} context={context} />
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <InnerApp />
  </ThemeProvider>
);

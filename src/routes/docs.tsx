import { createFileRoute } from "@tanstack/react-router";
import { ShellDocsPage } from "@/components/docs/shell-docs-page";

export const Route = createFileRoute("/docs")({
  component: DocsRoute,
});

function DocsRoute() {
  return <ShellDocsPage />;
}

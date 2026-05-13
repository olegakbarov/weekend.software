import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/shared")({
  beforeLoad: () => {
    throw redirect({ to: "/settings", search: { tab: "shared" } });
  },
});

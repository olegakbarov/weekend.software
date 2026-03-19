import { createFileRoute } from "@tanstack/react-router";
import { SkillsPage } from "@/components/skills/skills-page";

export const Route = createFileRoute("/skills")({
  component: SkillsRoute,
});

function SkillsRoute() {
  return <SkillsPage />;
}

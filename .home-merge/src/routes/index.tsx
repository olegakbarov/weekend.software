import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  Landmark,
  Mail,
  Search,
} from "lucide-react";
import {
  CalendarPreview,
  FinancePreview,
  GmailPreview,
  ResearchPreview,
} from "~/components/home/project-previews";
import { ProjectTile } from "~/components/home/project-tile";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const projects = [
    {
      title: "Gmail",
      eyebrow: "Communication",
      description: "Inbox",
      meta: "OAuth-backed inbox",
      to: "/gmail",
      icon: Mail,
      preview: <GmailPreview />,
    },
    {
      title: "Calendar",
      eyebrow: "Planning",
      description: "Today / Tomorrow",
      meta: "TanStack Start source",
      to: "/calendar",
      icon: CalendarDays,
      preview: <CalendarPreview />,
    },
    {
      title: "Finance",
      eyebrow: "Operations",
      description: "Key stats",
      meta: "Charts + server data",
      to: "/finance",
      icon: Landmark,
      preview: <FinancePreview />,
    },
    {
      title: "Research",
      eyebrow: "Knowledge",
      description: "Summary",
      meta: "Design system source",
      to: "/research",
      icon: Search,
      preview: <ResearchPreview />,
    },
  ];

  return (
    <main className="min-h-screen overflow-auto p-3 sm:p-4">
      <div className="grid w-full gap-3 md:h-[calc(100vh-2rem)] md:grid-cols-2 md:grid-rows-2">
        {projects.map((project) => (
          <ProjectTile key={project.to} {...project} />
        ))}
      </div>
    </main>
  );
}

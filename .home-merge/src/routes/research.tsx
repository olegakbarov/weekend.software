import { useEffect, useState, type ComponentType } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FeatureLoading } from "~/components/feature-loading";

export const Route = createFileRoute("/research")({
  component: ResearchRouteComponent,
});

function ResearchRouteComponent() {
  const [Page, setPage] = useState<ComponentType | null>(null);

  useEffect(() => {
    let active = true;

    void import("~/features/research/page").then((module) => {
      if (active) {
        setPage(() => module.ResearchPage);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  if (!Page) {
    return <FeatureLoading title="Research" />;
  }

  return <Page />;
}

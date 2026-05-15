import { useEffect, useRef, useState, type ComponentType } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FeatureLoading } from "~/components/feature-loading";

export const Route = createFileRoute("/research")({
  component: ResearchRouteComponent,
});

function ResearchRouteComponent() {
  const pageRef = useRef<ComponentType | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    void import("~/features/research/page").then((module) => {
      if (active) {
        pageRef.current = module.ResearchPage;
        setIsLoaded(true);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const Page = pageRef.current;

  if (!isLoaded || !Page) {
    return <FeatureLoading title="Research" />;
  }

  return <Page />;
}

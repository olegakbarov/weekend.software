import { useEffect, useRef, useState, type ComponentType } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FeatureLoading } from "~/components/feature-loading";

export const Route = createFileRoute("/finance")({
  component: FinanceRouteComponent,
});

function FinanceRouteComponent() {
  const pageRef = useRef<ComponentType | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    void import("~/features/finance/page").then((module) => {
      if (active) {
        pageRef.current = module.FinancePage;
        setIsLoaded(true);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const Page = pageRef.current;

  if (!isLoaded || !Page) {
    return <FeatureLoading title="Finance" />;
  }

  return <Page />;
}

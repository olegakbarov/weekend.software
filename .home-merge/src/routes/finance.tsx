import { useEffect, useState, type ComponentType } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FeatureLoading } from "~/components/feature-loading";

export const Route = createFileRoute("/finance")({
  component: FinanceRouteComponent,
});

function FinanceRouteComponent() {
  const [Page, setPage] = useState<ComponentType | null>(null);

  useEffect(() => {
    let active = true;

    void import("~/features/finance/page").then((module) => {
      if (active) {
        setPage(() => module.FinancePage);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  if (!Page) {
    return <FeatureLoading title="Finance" />;
  }

  return <Page />;
}

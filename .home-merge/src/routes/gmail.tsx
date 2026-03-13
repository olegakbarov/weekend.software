import { useEffect, useState, type ComponentType } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FeatureLoading } from "~/components/feature-loading";

export const Route = createFileRoute("/gmail")({
  component: GmailRouteComponent,
});

function GmailRouteComponent() {
  const [Page, setPage] = useState<ComponentType | null>(null);

  useEffect(() => {
    let active = true;

    void import("~/features/gmail/page").then((module) => {
      if (active) {
        setPage(() => module.GmailPage);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  if (!Page) {
    return <FeatureLoading title="Gmail" />;
  }

  return <Page />;
}

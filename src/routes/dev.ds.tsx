import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { DocsApp } from "@/dev/docs/docs-app";
import "@/dev/docs/app.css";

const THEMES = ["fluid", "fluid-dark", "weekend-dark", "weekend-paper"] as const;
type Theme = (typeof THEMES)[number];

export const Route = createFileRoute("/dev/ds")({
  component: DesignSystemRoute,
});

function DesignSystemRoute() {
  const [theme, setTheme] = useState<Theme>("fluid");

  // Override the global data-theme on mount; restore weekend-dark on unmount.
  useEffect(() => {
    const previous = document.documentElement.dataset.theme ?? "weekend-dark";
    document.documentElement.dataset.theme = theme;
    return () => {
      document.documentElement.dataset.theme = previous;
    };
  }, [theme]);

  const cycleTheme = useCallback(() => {
    setTheme((current) => {
      const idx = THEMES.indexOf(current);
      return THEMES[(idx + 1) % THEMES.length] ?? "fluid";
    });
  }, []);

  return (
    <div className="relative h-full w-full overflow-auto bg-background">
      {/* Theme toggle pinned in the corner */}
      <button
        type="button"
        onClick={cycleTheme}
        className="fixed bottom-4 right-4 z-50 rounded-md border border-border bg-card px-3 py-1.5 text-sm shadow-popover hover:bg-muted"
      >
        theme: {theme}
      </button>
      <DocsApp />
    </div>
  );
}

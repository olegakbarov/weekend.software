import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import {
  THEME_NAMES,
  type ThemeName,
} from "@/components/theme/theme-provider";
import { useTheme } from "@/components/theme/use-theme";
import { DocsApp } from "@/dev/docs/docs-app";
import "@/dev/docs/app.css";

export const Route = createFileRoute("/dev/ds")({
  component: DesignSystemRoute,
});

function DesignSystemRoute() {
  const { activeTheme, setActiveTheme } = useTheme();

  const cycleTheme = useCallback(() => {
    const idx = THEME_NAMES.indexOf(activeTheme);
    const next = THEME_NAMES[(idx + 1) % THEME_NAMES.length] ?? "fluid";
    setActiveTheme(next as ThemeName);
  }, [activeTheme, setActiveTheme]);

  // The host app uses TanStack hash history, so location.hash is reserved for
  // the host router. Embedded docs contain anchors like <a href="/about"> (demo
  // links) and <a href="#section-id"> (heading anchors) — both would clobber
  // TanStack's hash. Intercept here: external links pass through, in-page
  // fragments scroll manually without touching location.hash, everything else
  // is blocked.
  const handleAnchorIntercept = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href) return;
    if (href.startsWith("http") || href.startsWith("mailto:")) return;
    event.preventDefault();
    if (href.startsWith("#") && !href.startsWith("#/")) {
      const id = href.slice(1);
      if (id) document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  return (
    <div
      className="relative h-full w-full overflow-auto bg-background"
      onClick={handleAnchorIntercept}
    >
      <DocsApp theme={activeTheme} onCycleTheme={cycleTheme} />
    </div>
  );
}

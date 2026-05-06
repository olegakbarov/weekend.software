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

  // Weekend's ThemeProvider writes design tokens directly as inline styles on
  // <html> (specificity 1,0,0,0), which beats every CSS rule including our
  // :root[data-theme="..."] blocks. While this route is mounted, we snapshot
  // and clear the inline tokens so the cascade can win, then restore on unmount.
  useEffect(() => {
    const root = document.documentElement;
    const stolen: Array<[string, string]> = [];
    const props: string[] = [];
    for (let i = 0; i < root.style.length; i += 1) {
      const prop = root.style[i];
      if (prop && prop.startsWith("--")) props.push(prop);
    }
    for (const prop of props) {
      stolen.push([prop, root.style.getPropertyValue(prop)]);
      root.style.removeProperty(prop);
    }
    return () => {
      for (const [prop, value] of stolen) root.style.setProperty(prop, value);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.theme ?? "weekend-dark";
    root.dataset.theme = theme;
    return () => {
      root.dataset.theme = previous;
    };
  }, [theme]);

  const cycleTheme = useCallback(() => {
    setTheme((current) => {
      const idx = THEMES.indexOf(current);
      return THEMES[(idx + 1) % THEMES.length] ?? "fluid";
    });
  }, []);

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
      <DocsApp theme={theme} onCycleTheme={cycleTheme} />
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { CommandPalette } from "./components/command-palette";
import { Topbar } from "./components/topbar";
import { useTweaks } from "./hooks/use-tweaks";
import { findRouteById, FLAT_ROUTES, DEFAULT_ROUTE } from "./routes";
import { useDocsRoute, setDocsRoute } from "./docs-route-store";
import { PAGE_REGISTRY } from "./views/page-registry";
import { PagePlaceholder } from "./views/page-placeholder";

interface DocsAppProps {
  theme: string;
  onCycleTheme: () => void;
}

export function DocsApp({ theme, onCycleTheme }: DocsAppProps): React.JSX.Element {
  const route = useDocsRoute();
  const [tweaks, setTweak] = useTweaks();
  const [cmdOpen, setCmdOpen] = useState(false);

  const openCmd = useCallback(() => setCmdOpen(true), []);
  const closeCmd = useCallback(() => setCmdOpen(false), []);
  const navAndClose = useCallback((id: string) => {
    setDocsRoute(id);
    setCmdOpen(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
        return;
      }
      if (e.key === "Escape") {
        setCmdOpen(false);
        return;
      }
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.metaKey || e.ctrlKey) return;
      if (e.key.toLowerCase() === "r") {
        setTweak("shape", tweaks.shape === "pill" ? "rounded" : "pill");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tweaks.shape, setTweak]);

  const current = findRouteById(route) ?? findRouteById(DEFAULT_ROUTE) ?? FLAT_ROUTES[0];
  if (!current) throw new Error("No routes defined");

  return (
    <>
      <main className="docs-embedded-main">
        <Topbar
          current={current}
          theme={theme}
          onCycleTheme={onCycleTheme}
          shape={tweaks.shape}
          onCycleShape={() => setTweak("shape", tweaks.shape === "pill" ? "rounded" : "pill")}
          onOpenCmd={openCmd}
        />
        <div className="page" data-screen-label={current.name}>
          {(() => {
            const PageComponent = PAGE_REGISTRY[current.id];
            return PageComponent ? <PageComponent /> : <PagePlaceholder route={current} />;
          })()}
        </div>
      </main>

      <CommandPalette open={cmdOpen} onClose={closeCmd} onNav={navAndClose} />
    </>
  );
}

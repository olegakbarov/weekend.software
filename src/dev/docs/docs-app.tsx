import { useCallback, useEffect, useState } from "react";
import { CommandPalette } from "./components/command-palette";
import { Sidebar } from "./components/sidebar";
import { Topbar } from "./components/topbar";
import { useHashRoute } from "./hooks/use-hash-route";
import { useTweaks } from "./hooks/use-tweaks";
import { findRouteById, FLAT_ROUTES, DEFAULT_ROUTE } from "./routes";
import { PAGE_REGISTRY } from "./views/page-registry";
import { PagePlaceholder } from "./views/page-placeholder";

export function DocsApp(): React.JSX.Element {
  const [route, navigate] = useHashRoute();
  const [tweaks, setTweak] = useTweaks();
  const [cmdOpen, setCmdOpen] = useState(false);

  const openCmd = useCallback(() => setCmdOpen(true), []);
  const closeCmd = useCallback(() => setCmdOpen(false), []);
  const navAndClose = useCallback(
    (id: string) => {
      navigate(id);
      setCmdOpen(false);
    },
    [navigate],
  );

  // ⌘K toggle, Escape close, R cycles shape (when not typing).
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
      <div className="layout" data-collapsed={tweaks.sidebarCollapsed ? true : undefined}>
        <Sidebar
          route={route}
          onNav={navigate}
          collapsed={tweaks.sidebarCollapsed}
          onToggleCollapse={() => setTweak("sidebarCollapsed", !tweaks.sidebarCollapsed)}
          onOpenCmd={openCmd}
        />
        <main>
          <Topbar
            current={current}
            theme={tweaks.theme}
            onToggleTheme={() =>
              setTweak("theme", tweaks.theme === "dark" ? "light" : "dark")
            }
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
      </div>

      <CommandPalette open={cmdOpen} onClose={closeCmd} onNav={navAndClose} />
    </>
  );
}

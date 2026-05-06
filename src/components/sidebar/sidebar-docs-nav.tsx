import { ROUTES } from "@/dev/docs/routes";
import { useDocsRoute, setDocsRoute } from "@/dev/docs/docs-route-store";
import { cn } from "@/lib/utils";

export function SidebarDocsNav() {
  const route = useDocsRoute();

  const navigateTo = (id: string) => {
    setDocsRoute(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-2">
        {ROUTES.map((group) => (
          <div key={group.group} className="mb-2">
            <div className="px-2 pb-1 pt-2 font-code text-[10px] uppercase tracking-wider text-muted-foreground/40">
              {group.group}
            </div>
            <div className="flex flex-col gap-px">
              {group.items.map((item) => {
                const isActive = route === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTo(item.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left font-sans text-[12px] transition-colors",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    {item.isNew && (
                      <span className="rounded-sm bg-foreground/10 px-1 py-0.5 text-[9px] uppercase tracking-wide">
                        new
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

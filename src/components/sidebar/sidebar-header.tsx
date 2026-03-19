import { Plus } from "lucide-react";
import { useSidebarData, useSidebarActions } from "@/components/sidebar/sidebar-context";
import { TRAFFIC_LIGHTS_SAFE_ZONE_PX } from "@/components/sidebar/sidebar-constants";
import { cn } from "@/lib/utils";

export function SidebarHeader() {
  const data = useSidebarData();
  const actions = useSidebarActions();

  return (
    <div className="shrink-0 px-2">
      <div className="flex h-12 items-center">
        {!data.isFullscreen ? (
          <div
            className="h-full shrink-0"
            data-tauri-drag-region
            style={{ width: `${TRAFFIC_LIGHTS_SAFE_ZONE_PX}px` }}
          />
        ) : null}
        <div
          className={cn(
            "min-w-0 flex-1 px-2",
            data.showArchived
              ? "flex items-center justify-center font-vcr text-[12px] text-muted-foreground/50"
              : null,
          )}
          data-tauri-drag-region={!data.isFullscreen || undefined}
        >
          {data.showArchived ? "ARCHIVED PROJECTS" : null}
        </div>
        <button
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-2 rounded-md border px-3 font-vcr text-[12px] uppercase tracking-wide leading-none transition-colors",
            "border-border bg-transparent text-muted-foreground hover:text-foreground",
          )}
          onClick={actions.onOpenHome}
          title="New project"
          type="button"
        >
          <Plus className="size-3.5 shrink-0" />
          <span>New</span>
        </button>
      </div>
    </div>
  );
}

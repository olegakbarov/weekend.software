import { Plus, Settings } from "lucide-react";
import { useSidebarData, useSidebarActions } from "@/components/sidebar/sidebar-context";
import { FooterIconButton } from "@/components/sidebar/footer-icon-button";
import { cn } from "@/lib/utils";

export function SidebarFooter() {
  const data = useSidebarData();
  const actions = useSidebarActions();

  return (
    <div className="flex shrink-0 items-center justify-between border-border/40 border-t px-2 py-1">
      <button
        className={cn(
          "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 font-vcr text-[11px] uppercase tracking-wide leading-none transition-colors",
          "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        onClick={actions.onOpenHome}
        title="New project"
        type="button"
      >
        <Plus className="size-3 shrink-0" />
        <span>New</span>
      </button>
      <FooterIconButton
        active={data.currentRoute === "settings"}
        icon={<Settings className="size-3.5" />}
        onClick={actions.onOpenSettings}
        title="Settings"
      />
    </div>
  );
}

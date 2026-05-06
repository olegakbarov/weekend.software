import { Palette } from "lucide-react";
import { useSidebarData, useSidebarActions } from "@/components/sidebar/sidebar-context";
import { cn } from "@/lib/utils";

export function SidebarDevLink() {
  const { currentRoute } = useSidebarData();
  const { onOpenDesignSystem } = useSidebarActions();
  const isActive = currentRoute === "dev-ds";

  return (
    <div className="shrink-0 border-border/40 border-b px-1.5 py-1">
      <button
        type="button"
        onClick={onOpenDesignSystem}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
          isActive
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
        )}
      >
        <Palette className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-sans text-[12px] lowercase tracking-wide">
          design system
        </span>
      </button>
    </div>
  );
}

import { Plus, Settings, Palette, ArrowLeft, BookOpenText } from "lucide-react";
import { useSidebarData, useSidebarActions } from "@/components/sidebar/sidebar-context";
import { FooterIconButton } from "@/components/sidebar/footer-icon-button";
import { cn } from "@/lib/utils";

export function SidebarFooter() {
  const data = useSidebarData();
  const actions = useSidebarActions();
  const isBackMode =
    data.currentRoute === "dev-ds" ||
    data.currentRoute === "docs" ||
    data.currentRoute === "settings";

  return (
    <div className="flex shrink-0 items-center justify-between border-border/40 border-t px-2 py-1">
      {isBackMode ? (
        <button
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 font-vcr text-[11px] uppercase tracking-wide leading-none",
            "text-muted-foreground/80 transition-[background-color,color,transform] duration-100 hover:bg-muted/60 hover:text-foreground active:scale-[0.96]",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/70",
          )}
          onClick={actions.onOpenHome}
          title="Back"
          type="button"
        >
          <ArrowLeft className="size-3 shrink-0" />
          <span>Back</span>
        </button>
      ) : (
        <button
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 font-vcr text-[11px] uppercase tracking-wide leading-none",
            "text-muted-foreground/80 transition-[background-color,color,transform] duration-100 hover:bg-muted/60 hover:text-foreground active:scale-[0.96]",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/70",
          )}
          onClick={actions.onOpenHome}
          title="New project"
          type="button"
        >
          <Plus className="size-3 shrink-0" />
          <span>New</span>
        </button>
      )}
      <div className="flex items-center gap-0.5">
        <FooterIconButton
          active={data.currentRoute === "docs"}
          icon={<BookOpenText className="size-3.5" />}
          onClick={actions.onOpenDocs}
          title="Docs"
        />
        <FooterIconButton
          active={data.currentRoute === "dev-ds"}
          icon={<Palette className="size-3.5" />}
          onClick={actions.onOpenDesignSystem}
          title="Design system"
        />
        <FooterIconButton
          active={data.currentRoute === "settings"}
          icon={<Settings className="size-3.5" />}
          onClick={actions.onOpenSettings}
          title="Settings"
        />
      </div>
    </div>
  );
}

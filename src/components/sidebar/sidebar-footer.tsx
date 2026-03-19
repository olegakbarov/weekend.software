import { Archive, FileText, PanelLeftClose, Settings } from "lucide-react";
import { useSidebarData, useSidebarActions } from "@/components/sidebar/sidebar-context";
import { FooterIconButton } from "@/components/sidebar/footer-icon-button";

export function SidebarFooter() {
  const data = useSidebarData();
  const actions = useSidebarActions();

  return (
    <div className="flex shrink-0 items-center justify-between border-border/40 border-t px-2 py-1">
      <div className="flex items-center gap-0.5">
        <FooterIconButton
          active={data.currentRoute === "logs"}
          icon={<FileText className="size-3.5" />}
          onClick={actions.onOpenLogs}
          title="Logs"
        />
        <FooterIconButton
          active={data.showArchived}
          icon={<Archive className="size-3.5" />}
          onClick={actions.onToggleShowArchived}
          title={
            data.showArchived ? "Show active projects" : "Show archived projects"
          }
        />
        <FooterIconButton
          active={data.currentRoute === "settings"}
          icon={<Settings className="size-3.5" />}
          onClick={actions.onOpenSettings}
          title="Settings"
        />
      </div>
      {actions.onToggleSidebar && (
        <FooterIconButton
          icon={<PanelLeftClose className="size-3.5" />}
          onClick={actions.onToggleSidebar}
          title="Collapse sidebar (⌘B)"
        />
      )}
    </div>
  );
}

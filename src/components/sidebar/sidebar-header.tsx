import { PanelLeftClose } from "lucide-react";
import { useSidebarData, useSidebarActions } from "@/components/sidebar/sidebar-context";
import { TRAFFIC_LIGHTS_SAFE_ZONE_PX } from "@/components/sidebar/sidebar-constants";
import { FooterIconButton } from "@/components/sidebar/footer-icon-button";

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
          className="min-w-0 flex-1 px-2"
          data-tauri-drag-region={!data.isFullscreen || undefined}
        />
        {actions.onToggleSidebar && (
          <FooterIconButton
            icon={<PanelLeftClose className="size-3.5" />}
            onClick={actions.onToggleSidebar}
            title="Collapse sidebar (⌘B)"
          />
        )}
      </div>
    </div>
  );
}

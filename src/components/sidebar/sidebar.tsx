import { SidebarHeader } from "@/components/sidebar/sidebar-header";
import { SidebarFooter } from "@/components/sidebar/sidebar-footer";
import { SidebarDocsNav } from "@/components/sidebar/sidebar-docs-nav";
import { SidebarShellDocsNav } from "@/components/sidebar/sidebar-shell-docs-nav";
import { SidebarSettingsNav } from "@/components/sidebar/sidebar-settings-nav";
import { SidebarProjectList } from "@/components/sidebar/sidebar-project-list";
import { SIDEBAR_WIDTH_PX } from "@/components/sidebar/sidebar-constants";
import { useSidebarData } from "@/components/sidebar/sidebar-context";

export function Sidebar() {
  const { currentRoute } = useSidebarData();
  const isDesignDocsMode = currentRoute === "dev-ds";
  const isShellDocsMode = currentRoute === "docs";
  const isSettingsMode = currentRoute === "settings";

  return (
    <aside
      className="flex h-full shrink-0 flex-col overflow-x-hidden border-border border-r bg-background"
      style={{ width: `${SIDEBAR_WIDTH_PX}px` }}
    >
      <SidebarHeader />
      {isDesignDocsMode ? (
        <SidebarDocsNav />
      ) : isShellDocsMode ? (
        <SidebarShellDocsNav />
      ) : isSettingsMode ? (
        <SidebarSettingsNav />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col [mask-image:linear-gradient(to_bottom,transparent,black_12px,black_calc(100%-12px),transparent)]">
          <SidebarProjectList />
        </div>
      )}
      <SidebarFooter />
    </aside>
  );
}

import { SidebarHeader } from "@/components/sidebar/sidebar-header";
import { SidebarFooter } from "@/components/sidebar/sidebar-footer";
import { SidebarDocsNav } from "@/components/sidebar/sidebar-docs-nav";
import { SidebarProjectList } from "@/components/sidebar/sidebar-project-list";
import { SIDEBAR_WIDTH_PX } from "@/components/sidebar/sidebar-constants";
import { useSidebarData } from "@/components/sidebar/sidebar-context";

export function Sidebar() {
  const { currentRoute } = useSidebarData();
  const isDocsMode = currentRoute === "dev-ds";

  return (
    <aside
      className="flex h-full shrink-0 flex-col overflow-x-hidden border-border border-r bg-background"
      style={{ width: `${SIDEBAR_WIDTH_PX}px` }}
    >
      <SidebarHeader />
      {isDocsMode ? (
        <SidebarDocsNav />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col [mask-image:linear-gradient(to_bottom,transparent,black_12px,black_calc(100%-12px),transparent)]">
          <SidebarProjectList />
        </div>
      )}
      <SidebarFooter />
    </aside>
  );
}

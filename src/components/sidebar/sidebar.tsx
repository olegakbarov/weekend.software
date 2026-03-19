import { SidebarHeader } from "@/components/sidebar/sidebar-header";
import { SidebarFooter } from "@/components/sidebar/sidebar-footer";
import { SidebarProjectList } from "@/components/sidebar/sidebar-project-list";
import { SIDEBAR_WIDTH_PX } from "@/components/sidebar/sidebar-constants";

export function Sidebar() {
  return (
    <aside
      className="flex h-full shrink-0 flex-col overflow-x-hidden border-border border-r bg-background"
      style={{ width: `${SIDEBAR_WIDTH_PX}px` }}
    >
      <SidebarHeader />
      <div className="flex min-h-0 flex-1 flex-col">
        <SidebarProjectList />
      </div>
      <SidebarFooter />
    </aside>
  );
}

import { useNavigate } from "@tanstack/react-router";
import {
  SETTINGS_NAV_GROUPS,
  type SettingsTab,
} from "@/components/settings/settings-tabs";
import { useSidebarData } from "@/components/sidebar/sidebar-context";
import { cn } from "@/lib/utils";

export function SidebarSettingsNav() {
  const navigate = useNavigate();
  const { currentSettingsTab } = useSidebarData();
  const activeTab = currentSettingsTab ?? "basic";

  const navigateTo = (tab: SettingsTab) => {
    void navigate({
      to: "/settings",
      search: { tab },
      replace: true,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sidebar-edge-scrollbar min-h-0 flex-1 overflow-y-auto px-1.5 py-2">
        {SETTINGS_NAV_GROUPS.map((group) => (
          <div key={group.group} className="mb-2">
            <div className="flex flex-col gap-px">
              {group.items.map((item) => {
                const isActive = activeTab === item.id;
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

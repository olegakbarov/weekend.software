export type SettingsTab = "basic" | "agents" | "shared" | "logs" | "advanced";

export const SETTINGS_TABS: ReadonlyArray<SettingsTab> = [
  "basic",
  "agents",
  "shared",
  "logs",
  "advanced",
];

export const SETTINGS_TAB_LABELS: Record<SettingsTab, string> = {
  basic: "Basic",
  agents: "Agents",
  shared: "Shared",
  logs: "Logs",
  advanced: "Advanced",
};

export type SettingsNavGroup = {
  group: string;
  items: Array<{
    id: SettingsTab;
    name: string;
  }>;
};

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    group: "Settings",
    items: [
      { id: "basic", name: "Basic" },
      { id: "agents", name: "Agents" },
      { id: "shared", name: "Shared" },
      { id: "logs", name: "Logs" },
      { id: "advanced", name: "Advanced" },
    ],
  },
];

export function isSettingsTab(value: unknown): value is SettingsTab {
  return (
    typeof value === "string" &&
    (SETTINGS_TABS as ReadonlyArray<string>).includes(value)
  );
}

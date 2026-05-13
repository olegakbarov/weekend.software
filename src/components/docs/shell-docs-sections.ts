export type ShellDocsSection = {
  id: string;
  name: string;
};

export type ShellDocsSectionGroup = {
  group: string;
  items: ShellDocsSection[];
};

export const SHELL_DOCS_GROUPS: ShellDocsSectionGroup[] = [
  {
    group: "Overview",
    items: [
      { id: "mental-model", name: "Mental model" },
      { id: "filesystem", name: "Project files" },
    ],
  },
  {
    group: "Runtime",
    items: [
      { id: "runtime", name: "Runtime config" },
      { id: "environment", name: "Environment" },
    ],
  },
  {
    group: "Bridge",
    items: [
      { id: "mcp", name: "MCP tools" },
      { id: "page-bridge", name: "Page bridge" },
    ],
  },
  {
    group: "Assets",
    items: [
      { id: "theme", name: "Theme" },
      { id: "shared-assets", name: "Shared assets" },
    ],
  },
];

export const SHELL_DOCS_SECTIONS = SHELL_DOCS_GROUPS.flatMap(
  (group) => group.items,
);

export const DEFAULT_SHELL_DOCS_SECTION =
  SHELL_DOCS_SECTIONS[0]?.id ?? "mental-model";

export function findShellDocsSection(id: string): ShellDocsSection | null {
  return SHELL_DOCS_SECTIONS.find((section) => section.id === id) ?? null;
}

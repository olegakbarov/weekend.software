export type WorkspaceSearch = {
  view: "browser" | "editor" | "terminal" | "settings";
  terminalId?: string;
};

export function buildWorkspaceLocation(
  project: string,
  search: WorkspaceSearch
): {
  to: "/workspace/$project";
  params: { project: string };
  search: WorkspaceSearch;
} {
  return {
    to: "/workspace/$project",
    params: { project },
    search,
  };
}

export function isTerminalOwnedByProject(
  project: string,
  terminalId: string | null | undefined
): boolean {
  if (!terminalId) return false;
  const separatorIndex = terminalId.indexOf(":");
  if (separatorIndex < 0) return false;
  return terminalId.slice(0, separatorIndex) === project;
}

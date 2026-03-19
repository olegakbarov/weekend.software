import type { WorkspaceControllerState } from "./types";

function firstProject(projects: string[]): string | null {
  const [first] = projects;
  return first ?? null;
}

function rekeyProjectScopedRecord<T>(
  record: Record<string, T>,
  oldName: string,
  newName: string
): Record<string, T> {
  if (!(oldName in record)) return record;
  const next = { ...record };
  const value = next[oldName];
  delete next[oldName];
  if (value !== undefined) {
    next[newName] = value;
  }
  return next;
}

function omitProjectScopedRecord<T>(
  record: Record<string, T>,
  projectName: string
): Record<string, T> {
  if (!(projectName in record)) return record;
  const next = { ...record };
  delete next[projectName];
  return next;
}

export function resolveFocusedProject(args: {
  projects: string[];
  currentFocusedProject: string | null;
  preferredProject?: string;
}): string | null {
  const { projects, currentFocusedProject, preferredProject } = args;

  if (preferredProject && projects.includes(preferredProject)) {
    return preferredProject;
  }
  if (currentFocusedProject && projects.includes(currentFocusedProject)) {
    return currentFocusedProject;
  }
  return firstProject(projects);
}

export function renameProjectState(
  previous: WorkspaceControllerState,
  oldName: string,
  newName: string
): WorkspaceControllerState {
  return {
    ...previous,
    projects: previous.projects.map((project) =>
      project === oldName ? newName : project
    ),
    focusedProject:
      previous.focusedProject === oldName ? newName : previous.focusedProject,
    projectTreeByProject: rekeyProjectScopedRecord(
      previous.projectTreeByProject,
      oldName,
      newName
    ),
    projectTreeLoadingByProject: rekeyProjectScopedRecord(
      previous.projectTreeLoadingByProject,
      oldName,
      newName
    ),
    projectTreeErrorByProject: rekeyProjectScopedRecord(
      previous.projectTreeErrorByProject,
      oldName,
      newName
    ),
    projectConfigSnapshotByProject: rekeyProjectScopedRecord(
      previous.projectConfigSnapshotByProject,
      oldName,
      newName
    ),
    projectConfigLoadingByProject: rekeyProjectScopedRecord(
      previous.projectConfigLoadingByProject,
      oldName,
      newName
    ),
    projectConfigErrorByProject: rekeyProjectScopedRecord(
      previous.projectConfigErrorByProject,
      oldName,
      newName
    ),
    filesystemEventVersionByProject: rekeyProjectScopedRecord(
      previous.filesystemEventVersionByProject,
      oldName,
      newName
    ),
    terminalSessionsByProject: rekeyProjectScopedRecord(
      previous.terminalSessionsByProject,
      oldName,
      newName
    ),
    playStateByProject: rekeyProjectScopedRecord(
      previous.playStateByProject,
      oldName,
      newName
    ),
    playErrorByProject: rekeyProjectScopedRecord(
      previous.playErrorByProject,
      oldName,
      newName
    ),
    runtimeProcessHealthyByProject: rekeyProjectScopedRecord(
      previous.runtimeProcessHealthyByProject,
      oldName,
      newName
    ),
    archivedProjects: previous.archivedProjects.map((project) =>
      project === oldName ? newName : project
    ),
  };
}

export function removeProjectState(
  previous: WorkspaceControllerState,
  projectName: string
): WorkspaceControllerState {
  return {
    ...previous,
    focusedProject:
      previous.focusedProject === projectName ? null : previous.focusedProject,
    projectTreeByProject: omitProjectScopedRecord(
      previous.projectTreeByProject,
      projectName
    ),
    projectTreeLoadingByProject: omitProjectScopedRecord(
      previous.projectTreeLoadingByProject,
      projectName
    ),
    projectTreeErrorByProject: omitProjectScopedRecord(
      previous.projectTreeErrorByProject,
      projectName
    ),
    projectConfigSnapshotByProject: omitProjectScopedRecord(
      previous.projectConfigSnapshotByProject,
      projectName
    ),
    projectConfigLoadingByProject: omitProjectScopedRecord(
      previous.projectConfigLoadingByProject,
      projectName
    ),
    projectConfigErrorByProject: omitProjectScopedRecord(
      previous.projectConfigErrorByProject,
      projectName
    ),
    filesystemEventVersionByProject: omitProjectScopedRecord(
      previous.filesystemEventVersionByProject,
      projectName
    ),
    terminalSessionsByProject: omitProjectScopedRecord(
      previous.terminalSessionsByProject,
      projectName
    ),
    playStateByProject: omitProjectScopedRecord(
      previous.playStateByProject,
      projectName
    ),
    playErrorByProject: omitProjectScopedRecord(
      previous.playErrorByProject,
      projectName
    ),
    runtimeProcessHealthyByProject: omitProjectScopedRecord(
      previous.runtimeProcessHealthyByProject,
      projectName
    ),
    archivedProjects: previous.archivedProjects.filter(
      (project) => project !== projectName
    ),
  };
}

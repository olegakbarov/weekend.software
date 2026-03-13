import { invoke } from "@tauri-apps/api/core";
import { terminalRegistry } from "@/lib/terminal-registry";
import { toErrorMessage } from "@/lib/utils/error";
import {
  type ControllerContext,
  type ProjectConfigReadSnapshot,
  type ProjectTreeNode,
  isUserProjectName,
} from "./types";
import {
  loadProjectOrderFromStorage,
  persistProjectOrder,
  persistTerminalSessions,
  reconcileProjectOrder,
} from "./persistence";
import {
  clearPlayStartTimeout,
  reconcileAllProjectRuntimeStates,
  reconcileProjectRuntimeState,
} from "./runtime";
import type { RuntimeInternals } from "./runtime";

function findDefaultProject(projects: string[]): string | null {
  if (projects.length === 0) return null;
  const [first] = projects;
  return first ?? null;
}

function extractProjectName(projectPath: string): string | null {
  const segments = projectPath.split(/[\\/]/).filter(Boolean);
  const candidate =
    segments.length > 0 ? segments[segments.length - 1] : undefined;
  if (!candidate) return null;
  const trimmed = candidate.trim();
  return trimmed ? trimmed : null;
}

export type ProjectInternals = {
  projectTreeRefreshByProject: Map<string, Promise<void>>;
  projectConfigRefreshByProject: Map<string, Promise<void>>;
};

export function refreshProjectTree(
  ctx: ControllerContext,
  internals: ProjectInternals,
  project: string
): Promise<void> {
  const projectName = project.trim();
  if (!projectName) return Promise.resolve();

  const inFlight = internals.projectTreeRefreshByProject.get(projectName);
  if (inFlight) {
    return inFlight;
  }

  const refreshPromise = (async () => {
    ctx.setState((previous) => ({
      ...previous,
      projectTreeLoadingByProject: {
        ...previous.projectTreeLoadingByProject,
        [projectName]: true,
      },
      projectTreeErrorByProject: {
        ...previous.projectTreeErrorByProject,
        [projectName]: null,
      },
    }));

    try {
      const tree = await invoke<ProjectTreeNode[]>("list_project_tree", {
        project: projectName,
      });

      ctx.setState((previous) => ({
        ...previous,
        projectTreeByProject: {
          ...previous.projectTreeByProject,
          [projectName]: tree,
        },
        projectTreeLoadingByProject: {
          ...previous.projectTreeLoadingByProject,
          [projectName]: false,
        },
        projectTreeErrorByProject: {
          ...previous.projectTreeErrorByProject,
          [projectName]: null,
        },
      }));
    } catch (error) {
      ctx.setState((previous) => ({
        ...previous,
        projectTreeLoadingByProject: {
          ...previous.projectTreeLoadingByProject,
          [projectName]: false,
        },
        projectTreeErrorByProject: {
          ...previous.projectTreeErrorByProject,
          [projectName]: toErrorMessage(error),
        },
      }));
      throw error;
    } finally {
      internals.projectTreeRefreshByProject.delete(projectName);
    }
  })();

  internals.projectTreeRefreshByProject.set(projectName, refreshPromise);
  return refreshPromise;
}

export function refreshProjectConfig(
  ctx: ControllerContext,
  projectInternals: ProjectInternals,
  runtimeInternals: RuntimeInternals,
  project: string
): Promise<void> {
  const projectName = project.trim();
  if (!projectName) return Promise.resolve();

  const inFlight = projectInternals.projectConfigRefreshByProject.get(projectName);
  if (inFlight) {
    return inFlight;
  }

  const refreshPromise = (async () => {
    ctx.setState((previous) => ({
      ...previous,
      projectConfigLoadingByProject: {
        ...previous.projectConfigLoadingByProject,
        [projectName]: true,
      },
      projectConfigErrorByProject: {
        ...previous.projectConfigErrorByProject,
        [projectName]: null,
      },
    }));

    try {
      const snapshot = await invoke<ProjectConfigReadSnapshot>(
        "project_config_read",
        {
          project: projectName,
        }
      );

      ctx.setState((previous) => ({
        ...previous,
        projectConfigSnapshotByProject: {
          ...previous.projectConfigSnapshotByProject,
          [projectName]: snapshot,
        },
        projectConfigLoadingByProject: {
          ...previous.projectConfigLoadingByProject,
          [projectName]: false,
        },
        projectConfigErrorByProject: {
          ...previous.projectConfigErrorByProject,
          [projectName]: null,
        },
      }));
      reconcileProjectRuntimeState(ctx, runtimeInternals, projectName);
    } catch (error) {
      ctx.setState((previous) => ({
        ...previous,
        projectConfigSnapshotByProject: {
          ...previous.projectConfigSnapshotByProject,
          [projectName]: null,
        },
        projectConfigLoadingByProject: {
          ...previous.projectConfigLoadingByProject,
          [projectName]: false,
        },
        projectConfigErrorByProject: {
          ...previous.projectConfigErrorByProject,
          [projectName]: toErrorMessage(error),
        },
      }));
      reconcileProjectRuntimeState(ctx, runtimeInternals, projectName);
      throw error;
    } finally {
      projectInternals.projectConfigRefreshByProject.delete(projectName);
    }
  })();

  projectInternals.projectConfigRefreshByProject.set(projectName, refreshPromise);
  return refreshPromise;
}

export function selectProject(
  ctx: ControllerContext,
  projectInternals: ProjectInternals,
  runtimeInternals: RuntimeInternals,
  project: string | null
): void {
  const state = ctx.getState();
  const nextFocusedProject =
    project && state.projects.includes(project) ? project : null;

  ctx.setState((previous) => {
    if (previous.focusedProject === nextFocusedProject) return previous;
    return {
      ...previous,
      focusedProject: nextFocusedProject,
    };
  });

  if (!nextFocusedProject) return;
  void refreshProjectTree(ctx, projectInternals, nextFocusedProject).catch(() => undefined);
  void refreshProjectConfig(ctx, projectInternals, runtimeInternals, nextFocusedProject).catch(() => undefined);
}

export async function loadProjects(
  ctx: ControllerContext,
  projectInternals: ProjectInternals,
  runtimeInternals: RuntimeInternals,
  preferredProject?: string
): Promise<void> {
  try {
    const backendProjects = (await invoke<string[]>("list_projects", { archived: false })).filter(
      isUserProjectName
    );
    const savedOrder = loadProjectOrderFromStorage();
    const projects = reconcileProjectOrder(savedOrder, backendProjects);
    persistProjectOrder(projects);

    const currentFocusedProject = ctx.getState().focusedProject;
    let nextFocusedProject: string | null;

    if (preferredProject && projects.includes(preferredProject)) {
      nextFocusedProject = preferredProject;
    } else if (
      currentFocusedProject &&
      projects.includes(currentFocusedProject)
    ) {
      nextFocusedProject = currentFocusedProject;
    } else {
      nextFocusedProject = findDefaultProject(projects);
    }

    ctx.setState((previous) => ({
      ...previous,
      projects,
      focusedProject: nextFocusedProject,
    }));

    if (!nextFocusedProject) {
      reconcileAllProjectRuntimeStates(ctx, runtimeInternals);
      return;
    }
    await Promise.all([
      refreshProjectTree(ctx, projectInternals, nextFocusedProject).catch(() => undefined),
      refreshProjectConfig(ctx, projectInternals, runtimeInternals, nextFocusedProject).catch(() => undefined),
    ]);
    reconcileAllProjectRuntimeStates(ctx, runtimeInternals);
  } catch {
    ctx.setState((previous) => ({
      ...previous,
      projects: [],
      focusedProject: null,
    }));
  }
}

export async function createProject(
  ctx: ControllerContext,
  projectInternals: ProjectInternals,
  runtimeInternals: RuntimeInternals,
  input: { name?: string; defaultAgentCommand?: string; githubRepoUrl?: string } = {}
): Promise<string> {
  const normalizedName = input.name?.trim();
  const normalizedAgentCommand = input.defaultAgentCommand?.trim();
  const normalizedGithubRepoUrl = input.githubRepoUrl?.trim();

  const createdPath = await invoke<string>("create_new_project", {
    name: normalizedName || undefined,
    defaultAgentCommand: normalizedAgentCommand || undefined,
    githubRepoUrl: normalizedGithubRepoUrl || undefined,
  });
  const createdName = extractProjectName(createdPath);

  await loadProjects(ctx, projectInternals, runtimeInternals, createdName ?? undefined);

  const state = ctx.getState();
  const resolvedProject =
    (createdName && state.projects.includes(createdName) ? createdName : null) ??
    state.focusedProject;

  if (!resolvedProject) {
    throw new Error("created project name could not be resolved");
  }

  await Promise.all([
    refreshProjectTree(ctx, projectInternals, resolvedProject).catch(() => undefined),
    refreshProjectConfig(ctx, projectInternals, runtimeInternals, resolvedProject).catch(() => undefined),
  ]);
  return resolvedProject;
}

export async function updateProjectConfig(
  ctx: ControllerContext,
  runtimeInternals: RuntimeInternals,
  project: string
): Promise<ProjectConfigReadSnapshot> {
  const projectName = project.trim();
  if (!projectName) {
    throw new Error("project is required");
  }

  ctx.setState((previous) => ({
    ...previous,
    projectConfigLoadingByProject: {
      ...previous.projectConfigLoadingByProject,
      [projectName]: true,
    },
    projectConfigErrorByProject: {
      ...previous.projectConfigErrorByProject,
      [projectName]: null,
    },
  }));

  try {
    const snapshot = await invoke<ProjectConfigReadSnapshot>(
      "project_config_write",
      {
        project: projectName,
      }
    );

    ctx.setState((previous) => ({
      ...previous,
      projectConfigSnapshotByProject: {
        ...previous.projectConfigSnapshotByProject,
        [projectName]: snapshot,
      },
      projectConfigLoadingByProject: {
        ...previous.projectConfigLoadingByProject,
        [projectName]: false,
      },
      projectConfigErrorByProject: {
        ...previous.projectConfigErrorByProject,
        [projectName]: null,
      },
    }));
    reconcileProjectRuntimeState(ctx, runtimeInternals, projectName);

    return snapshot;
  } catch (error) {
    ctx.setState((previous) => ({
      ...previous,
      projectConfigLoadingByProject: {
        ...previous.projectConfigLoadingByProject,
        [projectName]: false,
      },
      projectConfigErrorByProject: {
        ...previous.projectConfigErrorByProject,
        [projectName]: toErrorMessage(error),
      },
    }));
    reconcileProjectRuntimeState(ctx, runtimeInternals, projectName);
    throw error;
  }
}

export async function renameProject(
  ctx: ControllerContext,
  projectInternals: ProjectInternals,
  runtimeInternals: RuntimeInternals,
  oldName: string,
  newName: string
): Promise<string> {
  const trimmedOld = oldName.trim();
  const trimmedNew = newName.trim();
  if (!trimmedOld || !trimmedNew) {
    throw new Error("project name is required");
  }

  const resolvedName = await invoke<string>("rename_project", {
    oldName: trimmedOld,
    newName: trimmedNew,
  });

  ctx.setState((previous) => {
    const rekey = <T>(
      record: Record<string, T>
    ): Record<string, T> => {
      if (!(trimmedOld in record)) return record;
      const next = { ...record };
      const value = next[trimmedOld];
      delete next[trimmedOld];
      if (value !== undefined) {
        next[resolvedName] = value;
      }
      return next;
    };

    return {
      ...previous,
      projects: previous.projects.map((p) =>
        p === trimmedOld ? resolvedName : p
      ),
      focusedProject:
        previous.focusedProject === trimmedOld
          ? resolvedName
          : previous.focusedProject,
      projectTreeByProject: rekey(previous.projectTreeByProject),
      projectTreeLoadingByProject: rekey(previous.projectTreeLoadingByProject),
      projectTreeErrorByProject: rekey(previous.projectTreeErrorByProject),
      projectConfigSnapshotByProject: rekey(
        previous.projectConfigSnapshotByProject
      ),
      projectConfigLoadingByProject: rekey(
        previous.projectConfigLoadingByProject
      ),
      projectConfigErrorByProject: rekey(
        previous.projectConfigErrorByProject
      ),
      filesystemEventVersionByProject: rekey(
        previous.filesystemEventVersionByProject
      ),
      terminalSessionsByProject: rekey(previous.terminalSessionsByProject),
      playStateByProject: rekey(previous.playStateByProject),
      playErrorByProject: rekey(previous.playErrorByProject),
      runtimeProcessHealthyByProject: rekey(
        previous.runtimeProcessHealthyByProject
      ),
    };
  });

  persistTerminalSessions(ctx.getState().terminalSessionsByProject);

  const savedOrder = loadProjectOrderFromStorage();
  persistProjectOrder(savedOrder.map((p) => (p === trimmedOld ? resolvedName : p)));

  await loadProjects(ctx, projectInternals, runtimeInternals, resolvedName);
  return resolvedName;
}

export async function deleteProject(
  ctx: ControllerContext,
  projectInternals: ProjectInternals,
  runtimeInternals: RuntimeInternals,
  project: string
): Promise<void> {
  const projectName = project.trim();
  if (!projectName) return;
  clearPlayStartTimeout(runtimeInternals, projectName);

  terminalRegistry.destroyAllForProject(projectName);

  await invoke("delete_project", { project: projectName });

  ctx.setState((previous) => {
    const nextProjectTreeByProject = { ...previous.projectTreeByProject };
    delete nextProjectTreeByProject[projectName];
    const nextProjectTreeLoadingByProject = { ...previous.projectTreeLoadingByProject };
    delete nextProjectTreeLoadingByProject[projectName];
    const nextProjectTreeErrorByProject = { ...previous.projectTreeErrorByProject };
    delete nextProjectTreeErrorByProject[projectName];
    const nextProjectConfigSnapshotByProject = { ...previous.projectConfigSnapshotByProject };
    delete nextProjectConfigSnapshotByProject[projectName];
    const nextProjectConfigLoadingByProject = { ...previous.projectConfigLoadingByProject };
    delete nextProjectConfigLoadingByProject[projectName];
    const nextProjectConfigErrorByProject = { ...previous.projectConfigErrorByProject };
    delete nextProjectConfigErrorByProject[projectName];
    const nextFilesystemEventVersionByProject = { ...previous.filesystemEventVersionByProject };
    delete nextFilesystemEventVersionByProject[projectName];
    const nextTerminalSessionsByProject = { ...previous.terminalSessionsByProject };
    delete nextTerminalSessionsByProject[projectName];
    const nextPlayStateByProject = { ...previous.playStateByProject };
    delete nextPlayStateByProject[projectName];
    const nextPlayErrorByProject = { ...previous.playErrorByProject };
    delete nextPlayErrorByProject[projectName];
    const nextRuntimeProcessHealthyByProject = { ...previous.runtimeProcessHealthyByProject };
    delete nextRuntimeProcessHealthyByProject[projectName];

    const next = {
      ...previous,
      focusedProject:
        previous.focusedProject === projectName ? null : previous.focusedProject,
      projectTreeByProject: nextProjectTreeByProject,
      projectTreeLoadingByProject: nextProjectTreeLoadingByProject,
      projectTreeErrorByProject: nextProjectTreeErrorByProject,
      projectConfigSnapshotByProject: nextProjectConfigSnapshotByProject,
      projectConfigLoadingByProject: nextProjectConfigLoadingByProject,
      projectConfigErrorByProject: nextProjectConfigErrorByProject,
      filesystemEventVersionByProject: nextFilesystemEventVersionByProject,
      terminalSessionsByProject: nextTerminalSessionsByProject,
      playStateByProject: nextPlayStateByProject,
      playErrorByProject: nextPlayErrorByProject,
      runtimeProcessHealthyByProject: nextRuntimeProcessHealthyByProject,
    };
    persistTerminalSessions(next.terminalSessionsByProject);
    return next;
  });

  projectInternals.projectTreeRefreshByProject.delete(projectName);
  projectInternals.projectConfigRefreshByProject.delete(projectName);
  await loadProjects(ctx, projectInternals, runtimeInternals);
}

export async function archiveProject(
  ctx: ControllerContext,
  projectInternals: ProjectInternals,
  runtimeInternals: RuntimeInternals,
  project: string
): Promise<void> {
  const projectName = project.trim();
  if (!projectName) return;
  clearPlayStartTimeout(runtimeInternals, projectName);

  terminalRegistry.destroyAllForProject(projectName);

  await invoke("archive_project", { project: projectName });

  ctx.setState((previous) => {
    const nextProjectTreeByProject = { ...previous.projectTreeByProject };
    delete nextProjectTreeByProject[projectName];
    const nextProjectTreeLoadingByProject = { ...previous.projectTreeLoadingByProject };
    delete nextProjectTreeLoadingByProject[projectName];
    const nextProjectTreeErrorByProject = { ...previous.projectTreeErrorByProject };
    delete nextProjectTreeErrorByProject[projectName];
    const nextProjectConfigSnapshotByProject = { ...previous.projectConfigSnapshotByProject };
    delete nextProjectConfigSnapshotByProject[projectName];
    const nextProjectConfigLoadingByProject = { ...previous.projectConfigLoadingByProject };
    delete nextProjectConfigLoadingByProject[projectName];
    const nextProjectConfigErrorByProject = { ...previous.projectConfigErrorByProject };
    delete nextProjectConfigErrorByProject[projectName];
    const nextFilesystemEventVersionByProject = { ...previous.filesystemEventVersionByProject };
    delete nextFilesystemEventVersionByProject[projectName];
    const nextTerminalSessionsByProject = { ...previous.terminalSessionsByProject };
    delete nextTerminalSessionsByProject[projectName];
    const nextPlayStateByProject = { ...previous.playStateByProject };
    delete nextPlayStateByProject[projectName];
    const nextPlayErrorByProject = { ...previous.playErrorByProject };
    delete nextPlayErrorByProject[projectName];
    const nextRuntimeProcessHealthyByProject = { ...previous.runtimeProcessHealthyByProject };
    delete nextRuntimeProcessHealthyByProject[projectName];

    const next = {
      ...previous,
      focusedProject:
        previous.focusedProject === projectName ? null : previous.focusedProject,
      projectTreeByProject: nextProjectTreeByProject,
      projectTreeLoadingByProject: nextProjectTreeLoadingByProject,
      projectTreeErrorByProject: nextProjectTreeErrorByProject,
      projectConfigSnapshotByProject: nextProjectConfigSnapshotByProject,
      projectConfigLoadingByProject: nextProjectConfigLoadingByProject,
      projectConfigErrorByProject: nextProjectConfigErrorByProject,
      filesystemEventVersionByProject: nextFilesystemEventVersionByProject,
      terminalSessionsByProject: nextTerminalSessionsByProject,
      playStateByProject: nextPlayStateByProject,
      playErrorByProject: nextPlayErrorByProject,
      runtimeProcessHealthyByProject: nextRuntimeProcessHealthyByProject,
    };
    persistTerminalSessions(next.terminalSessionsByProject);
    return next;
  });

  projectInternals.projectTreeRefreshByProject.delete(projectName);
  projectInternals.projectConfigRefreshByProject.delete(projectName);
  await loadProjects(ctx, projectInternals, runtimeInternals);
}

export async function unarchiveProject(
  ctx: ControllerContext,
  projectInternals: ProjectInternals,
  runtimeInternals: RuntimeInternals,
  project: string
): Promise<void> {
  const projectName = project.trim();
  if (!projectName) return;

  await invoke("unarchive_project", { project: projectName });
  await loadProjects(ctx, projectInternals, runtimeInternals, projectName);
  await loadArchivedProjects(ctx);
}

export function reorderProjects(
  ctx: ControllerContext,
  reordered: string[]
): void {
  persistProjectOrder(reordered);
  ctx.setState((previous) => ({
    ...previous,
    projects: reordered,
  }));
}

export async function loadArchivedProjects(
  ctx: ControllerContext
): Promise<void> {
  try {
    const archived = (await invoke<string[]>("list_projects", { archived: true })).filter(
      isUserProjectName
    );
    ctx.setState((previous) => ({
      ...previous,
      archivedProjects: archived,
    }));
  } catch {
    ctx.setState((previous) => ({
      ...previous,
      archivedProjects: [],
    }));
  }
}

export function toggleShowArchived(
  ctx: ControllerContext
): void {
  let shouldLoad = false;
  ctx.setState((previous) => {
    shouldLoad = !previous.showArchived;
    return { ...previous, showArchived: shouldLoad };
  });
  if (shouldLoad) {
    void loadArchivedProjects(ctx).catch(() => undefined);
  }
}

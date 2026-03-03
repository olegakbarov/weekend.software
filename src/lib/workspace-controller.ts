import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  type TerminalSessionDescriptor,
  type ProcessEntrySnapshot,
  type ProcessRole,
  makeTerminalId,
} from "@/lib/types";
import { terminalRegistry } from "@/lib/terminal-registry";
import {
  safeLocalStorageGetItem,
  safeLocalStorageSetItem,
} from "@/lib/utils/safe-local-storage";

export type ProjectTreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  children: ProjectTreeNode[];
};

export type RuntimeDebugSnapshot = {
  generatedAtUnixMs: number;
  terminalIds: string[];
};

export type ProjectConfigReadSnapshot = {
  project: string;
  projectDir: string;
  configPath: string;
  configExists: boolean;
  configValid: boolean;
  runtimeHost: string | null;
  runtimePort: number | null;
  startupCommands: string[];
  processes: Record<string, ProcessEntrySnapshot>;
  source: string;
  error: string | null;
  portRangeStart: number;
  portRangeEnd: number;
};

export type SharedAssetSnapshot = {
  fileName: string;
  sizeBytes: number;
  modifiedAtUnixMs: number | null;
};

type SharedAssetUploadInput = {
  fileName: string;
  dataBase64: string;
};

type ProjectTreeChangedPayload = {
  project: string;
};

const RESERVED_PROJECT_NAMES = new Set(["logs", "shared-assets"]);
const TERMINAL_SESSIONS_STORAGE_KEY = "weekend.terminal-sessions-by-project.v1";
const PROJECT_ORDER_STORAGE_KEY = "weekend.project-order.v1";

function isUserProjectName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return !RESERVED_PROJECT_NAMES.has(trimmed.toLowerCase());
}

export type PlayState = "idle" | "starting" | "running" | "failed";

export type WorkspaceControllerState = {
  initialized: boolean;
  shellName: string;
  projects: string[];
  selectedProject: string | null;
  projectTreeByProject: Record<string, ProjectTreeNode[]>;
  projectTreeLoadingByProject: Record<string, boolean>;
  projectTreeErrorByProject: Record<string, string | null>;
  projectConfigSnapshotByProject: Record<string, ProjectConfigReadSnapshot | null>;
  projectConfigLoadingByProject: Record<string, boolean>;
  projectConfigErrorByProject: Record<string, string | null>;
  filesystemEventVersion: number;
  filesystemEventVersionByProject: Record<string, number>;
  runtimeDebugSnapshot: RuntimeDebugSnapshot | null;
  runtimeDebugError: string | null;
  terminalSessionsByProject: Record<string, TerminalSessionDescriptor[]>;
  playStateByProject: Record<string, PlayState>;
  playErrorByProject: Record<string, string | null>;
  runtimeProcessHealthyByProject: Record<string, boolean>;
  archivedProjects: string[];
  showArchived: boolean;
  sharedAssets: SharedAssetSnapshot[];
  sharedAssetsLoading: boolean;
  sharedAssetsError: string | null;
  sharedAssetsUploading: boolean;
};

const PLAY_START_TIMEOUT_MS = 20000;

function isRuntimeProcessRole(role: ProcessRole | null): boolean {
  return role === "dev-server" || role === "service";
}

function hasHealthyRuntimeProcessForProject(
  sessionsByProject: Record<string, TerminalSessionDescriptor[]>,
  project: string
): boolean {
  return (sessionsByProject[project] ?? []).some(
    (session) =>
      session.playSpawned &&
      session.status === "alive" &&
      session.hasActiveProcess &&
      isRuntimeProcessRole(session.processRole)
  );
}

function findDefaultProject(projects: string[]): string | null {
  if (projects.length === 0) return null;
  const [first] = projects;
  return first ?? null;
}

function toErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const trimmed = message.trim();
  return trimmed.length > 0 ? trimmed : "Unknown error";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error(`failed to read "${file.name}"`));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error(`failed to read "${file.name}"`));
    };
    reader.readAsDataURL(file);
  });
}

async function toSharedAssetUploadPayload(
  file: File
): Promise<SharedAssetUploadInput> {
  const dataUrl = await readFileAsDataUrl(file);
  const commaIndex = dataUrl.indexOf(",");
  const dataBase64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  return {
    fileName: file.name,
    dataBase64,
  };
}

function extractProjectName(projectPath: string): string | null {
  const segments = projectPath.split(/[\\/]/).filter(Boolean);
  const candidate =
    segments.length > 0 ? segments[segments.length - 1] : undefined;
  if (!candidate) return null;
  const trimmed = candidate.trim();
  return trimmed ? trimmed : null;
}

function loadTerminalSessionsFromStorage(): Record<
  string,
  TerminalSessionDescriptor[]
> {
  const serialized = safeLocalStorageGetItem(TERMINAL_SESSIONS_STORAGE_KEY);
  if (!serialized) return {};

  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!parsed || typeof parsed !== "object") return {};

    const result: Record<string, TerminalSessionDescriptor[]> = {};
    for (const [project, value] of Object.entries(
      parsed as Record<string, unknown>
    )) {
      const projectName = project.trim();
      if (!projectName) continue;
      if (!Array.isArray(value)) continue;
      const descriptors: TerminalSessionDescriptor[] = [];
      const seenTerminalIds = new Set<string>();
      const seenLabels = new Set<string>();
      for (const item of value) {
        if (!item || typeof item !== "object") continue;
        const candidate = item as TerminalSessionDescriptor;
        if (
          typeof candidate.terminalId !== "string" ||
          typeof candidate.project !== "string" ||
          typeof candidate.label !== "string" ||
          typeof candidate.createdAt !== "number"
        ) {
          continue;
        }

        const terminalId = candidate.terminalId.trim();
        const label = candidate.label.trim();
        if (!terminalId || seenTerminalIds.has(terminalId)) {
          continue;
        }
        if (!label || seenLabels.has(label)) continue;

        seenTerminalIds.add(terminalId);
        seenLabels.add(label);
        descriptors.push({
          ...candidate,
          terminalId,
          project: projectName,
          displayName: typeof candidate.displayName === "string" ? candidate.displayName : label,
          customName: typeof candidate.customName === "string" ? candidate.customName : null,
          status: candidate.status === "alive" || candidate.status === "exited" ? candidate.status : "alive",
          hasActiveProcess: candidate.hasActiveProcess === true,
          foregroundProcessName:
            typeof candidate.foregroundProcessName === "string"
              ? candidate.foregroundProcessName
              : null,
          label,
          playSpawned: typeof candidate.playSpawned === "boolean" ? candidate.playSpawned : false,
          processRole: typeof candidate.processRole === "string" ? candidate.processRole as ProcessRole : null,
        });
      }
      if (descriptors.length > 0) {
        result[projectName] = descriptors;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function persistTerminalSessions(
  sessionsByProject: Record<string, TerminalSessionDescriptor[]>
): void {
  safeLocalStorageSetItem(
    TERMINAL_SESSIONS_STORAGE_KEY,
    JSON.stringify(sessionsByProject)
  );
}

function loadProjectOrderFromStorage(): string[] {
  const serialized = safeLocalStorageGetItem(PROJECT_ORDER_STORAGE_KEY);
  if (!serialized) return [];
  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  } catch {
    return [];
  }
}

function persistProjectOrder(order: string[]): void {
  safeLocalStorageSetItem(PROJECT_ORDER_STORAGE_KEY, JSON.stringify(order));
}

function reconcileProjectOrder(
  savedOrder: string[],
  backendProjects: string[]
): string[] {
  const backendSet = new Set(backendProjects);
  // Keep saved entries that still exist in backend
  const kept = savedOrder.filter((name) => backendSet.has(name));
  const keptSet = new Set(kept);
  // Append new projects not in saved order
  const added = backendProjects.filter((name) => !keptSet.has(name));
  return [...kept, ...added];
}

function generateUniqueTerminalName(
  existing: TerminalSessionDescriptor[],
  project: string,
  baseLabel: string
): { label: string; terminalId: string } {
  const usedLabels = new Set(existing.map((d) => d.label));
  const usedTerminalIds = new Set(existing.map((d) => d.terminalId));
  let label = baseLabel;
  let terminalId = makeTerminalId(project, label);
  if (!usedLabels.has(label) && !usedTerminalIds.has(terminalId)) {
    return { label, terminalId };
  }

  let counter = 2;
  while (true) {
    label = `${baseLabel} ${counter}`;
    terminalId = makeTerminalId(project, label);
    if (!usedLabels.has(label) && !usedTerminalIds.has(terminalId)) {
      return { label, terminalId };
    }
    counter++;
  }
}


export function createWorkspaceController() {
  let state: WorkspaceControllerState = {
    initialized: false,
    shellName: "zsh",
    projects: [],
    selectedProject: null,
    projectTreeByProject: {},
    projectTreeLoadingByProject: {},
    projectTreeErrorByProject: {},
    projectConfigSnapshotByProject: {},
    projectConfigLoadingByProject: {},
    projectConfigErrorByProject: {},
    filesystemEventVersion: 0,
    filesystemEventVersionByProject: {},
    runtimeDebugSnapshot: null,
    runtimeDebugError: null,
    terminalSessionsByProject: loadTerminalSessionsFromStorage(),
    playStateByProject: {},
    playErrorByProject: {},
    runtimeProcessHealthyByProject: {},
    archivedProjects: [],
    showArchived: false,
    sharedAssets: [],
    sharedAssetsLoading: false,
    sharedAssetsError: null,
    sharedAssetsUploading: false,
  };
  persistTerminalSessions(state.terminalSessionsByProject);

  const subscribers = new Set<() => void>();
  const projectTreeRefreshByProject = new Map<string, Promise<void>>();
  const projectConfigRefreshByProject = new Map<string, Promise<void>>();
  let unlistenFns: UnlistenFn[] = [];
  let initPromise: Promise<void> | null = null;
  let runtimeSnapshotRefreshPromise: Promise<void> | null = null;
  let runtimeDebugPollIntervalId: number | null = null;
  const playStartTimeoutByProject = new Map<string, number>();

  const notify = () => {
    for (const listener of Array.from(subscribers)) {
      listener();
    }
  };

  const setState = (
    updater: (previous: WorkspaceControllerState) => WorkspaceControllerState
  ): void => {
    const next = updater(state);
    if (next === state) return;
    state = next;
    notify();
  };

  const startRuntimeDebugPolling = (): void => {
    if (runtimeDebugPollIntervalId !== null) return;
    runtimeDebugPollIntervalId = window.setInterval(() => {
      void refreshRuntimeSnapshot().catch(() => undefined);
    }, 2000);
  };

  const stopRuntimeDebugPolling = (): void => {
    if (runtimeDebugPollIntervalId === null) return;
    window.clearInterval(runtimeDebugPollIntervalId);
    runtimeDebugPollIntervalId = null;
  };

  const clearPlayStartTimeout = (project: string): void => {
    const timeoutId = playStartTimeoutByProject.get(project);
    if (timeoutId == null) return;
    window.clearTimeout(timeoutId);
    playStartTimeoutByProject.delete(project);
  };

  const setProjectPlayState = (
    project: string,
    nextState: PlayState,
    errorMessage: string | null
  ): void => {
    setState((previous) => {
      const currentState = previous.playStateByProject[project] ?? "idle";
      const currentError = previous.playErrorByProject[project] ?? null;
      if (currentState === nextState && currentError === errorMessage) {
        return previous;
      }
      return {
        ...previous,
        playStateByProject: {
          ...previous.playStateByProject,
          [project]: nextState,
        },
        playErrorByProject: {
          ...previous.playErrorByProject,
          [project]: errorMessage,
        },
      };
    });
  };

  const reconcileProjectRuntimeState = (project: string): void => {
    setState((previous) => {
      const runtimeHealthy = hasHealthyRuntimeProcessForProject(
        previous.terminalSessionsByProject,
        project
      );
      const currentHealthy = previous.runtimeProcessHealthyByProject[project] ?? false;
      const currentPlayState = previous.playStateByProject[project] ?? "idle";
      const currentError = previous.playErrorByProject[project] ?? null;
      let nextPlayState = currentPlayState;
      let nextError = currentError;

      if (runtimeHealthy) {
        clearPlayStartTimeout(project);
      }

      if (currentPlayState === "starting") {
        if (runtimeHealthy) {
          nextPlayState = "running";
          nextError = null;
        }
      } else if (currentPlayState === "running") {
        if (!runtimeHealthy) {
          nextPlayState = "failed";
          nextError = "Configured runtime process is not healthy.";
        }
      } else if (currentPlayState === "failed") {
        if (runtimeHealthy) {
          nextPlayState = "running";
          nextError = null;
        }
      } else if (currentPlayState === "idle") {
        if (runtimeHealthy) {
          nextPlayState = "running";
          nextError = null;
        }
      }

      if (
        currentHealthy === runtimeHealthy &&
        currentPlayState === nextPlayState &&
        currentError === nextError
      ) {
        return previous;
      }

      return {
        ...previous,
        runtimeProcessHealthyByProject: {
          ...previous.runtimeProcessHealthyByProject,
          [project]: runtimeHealthy,
        },
        playStateByProject: {
          ...previous.playStateByProject,
          [project]: nextPlayState,
        },
        playErrorByProject: {
          ...previous.playErrorByProject,
          [project]: nextError,
        },
      };
    });
  };

  const schedulePlayStartTimeout = (project: string): void => {
    clearPlayStartTimeout(project);
    const timeoutId = window.setTimeout(() => {
      playStartTimeoutByProject.delete(project);
      setState((previous) => {
        const current = previous.playStateByProject[project] ?? "idle";
        if (current !== "starting") return previous;
        return {
          ...previous,
          playStateByProject: {
            ...previous.playStateByProject,
            [project]: "failed",
          },
          playErrorByProject: {
            ...previous.playErrorByProject,
            [project]:
              "Startup timed out before any configured runtime process became healthy.",
          },
        };
      });
    }, PLAY_START_TIMEOUT_MS);
    playStartTimeoutByProject.set(project, timeoutId);
  };

  const reconcileAllProjectRuntimeStates = (): void => {
    const projects = new Set<string>([
      ...state.projects,
      ...Object.keys(state.terminalSessionsByProject),
      ...Object.keys(state.playStateByProject),
    ]);
    for (const project of projects) {
      reconcileProjectRuntimeState(project);
    }
  };

  const setupListeners = async (): Promise<void> => {
    if (unlistenFns.length > 0) return;

    const unlistenProjectTreeChanged = await listen<ProjectTreeChangedPayload>(
      "project-tree-changed",
      (event) => {
        const project = event.payload.project.trim();
        if (!isUserProjectName(project)) return;

        setState((previous) => ({
          ...previous,
          filesystemEventVersion: previous.filesystemEventVersion + 1,
          filesystemEventVersionByProject: {
            ...previous.filesystemEventVersionByProject,
            [project]: (previous.filesystemEventVersionByProject[project] ?? 0) + 1,
          },
        }));

        void refreshProjectTree(project).catch(() => undefined);
        void refreshProjectConfig(project).catch(() => undefined);
      }
    );

    type SessionChangedPayload = {
      terminalId: string;
      project: string;
      displayName: string;
      customName: string | null;
      status: "alive" | "exited";
      hasActiveProcess: boolean;
      foregroundProcessName: string | null;
      createdAt: number;
      playSpawned: boolean;
      processRole: ProcessRole | null;
    };

    const unlistenSessionChanged = await listen<SessionChangedPayload>(
      "terminal-session-changed",
      (event) => {
        const p = event.payload;
        const project = p.project.trim();
        if (!project) return;

        setState((previous) => {
          const existing = previous.terminalSessionsByProject[project] ?? [];
          const index = existing.findIndex((s) => s.terminalId === p.terminalId);
          const descriptor: TerminalSessionDescriptor = {
            terminalId: p.terminalId,
            project,
            displayName: p.displayName,
            customName: p.customName,
            status: p.status,
            hasActiveProcess: p.hasActiveProcess === true,
            foregroundProcessName:
              typeof p.foregroundProcessName === "string"
                ? p.foregroundProcessName
                : null,
            label: p.customName ?? p.displayName,
            createdAt: p.createdAt,
            playSpawned: p.playSpawned ?? false,
            processRole: p.processRole ?? null,
          };

          const updated =
            index >= 0
              ? existing.map((s, i) => (i === index ? descriptor : s))
              : [...existing, descriptor];

          const next = {
            ...previous,
            terminalSessionsByProject: {
              ...previous.terminalSessionsByProject,
              [project]: updated,
            },
          };
          persistTerminalSessions(next.terminalSessionsByProject);
          return next;
        });
        reconcileProjectRuntimeState(project);
      }
    );

    type SessionRemovedPayload = {
      terminalId: string;
    };

    const unlistenSessionRemoved = await listen<SessionRemovedPayload>(
      "terminal-session-removed",
      (event) => {
        const { terminalId } = event.payload;
        let affectedProject: string | null = null;

        setState((previous) => {
          const updated = { ...previous.terminalSessionsByProject };
          for (const [proj, sessions] of Object.entries(updated)) {
            const filtered = sessions.filter((s) => s.terminalId !== terminalId);
            if (filtered.length !== sessions.length) {
              affectedProject = proj;
              if (filtered.length === 0) {
                delete updated[proj];
              } else {
                updated[proj] = filtered;
              }
            }
          }
          const next = {
            ...previous,
            terminalSessionsByProject: updated,
          };
          persistTerminalSessions(next.terminalSessionsByProject);
          return next;
        });
        if (affectedProject) {
          reconcileProjectRuntimeState(affectedProject);
        }
      }
    );

    unlistenFns = [
      unlistenProjectTreeChanged,
      unlistenSessionChanged,
      unlistenSessionRemoved,
    ];
  };

  const getState = (): WorkspaceControllerState => state;

  const subscribe = (listener: () => void): (() => void) => {
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  };

  const selectProject = (project: string | null): void => {
    const nextSelectedProject =
      project && state.projects.includes(project) ? project : null;

    setState((previous) => {
      if (previous.selectedProject === nextSelectedProject) return previous;
      return {
        ...previous,
        selectedProject: nextSelectedProject,
      };
    });

    if (!nextSelectedProject) return;
    void refreshProjectTree(nextSelectedProject).catch(() => undefined);
    void refreshProjectConfig(nextSelectedProject).catch(() => undefined);
  };

  const refreshProjectTree = async (project: string): Promise<void> => {
    const projectName = project.trim();
    if (!projectName) return;

    const inFlight = projectTreeRefreshByProject.get(projectName);
    if (inFlight) {
      return inFlight;
    }

    const refreshPromise = (async () => {
      setState((previous) => ({
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

        setState((previous) => ({
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
        setState((previous) => ({
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
        projectTreeRefreshByProject.delete(projectName);
      }
    })();

    projectTreeRefreshByProject.set(projectName, refreshPromise);
    return refreshPromise;
  };

  const loadProjects = async (preferredProject?: string): Promise<void> => {
    try {
      const backendProjects = (await invoke<string[]>("list_projects", { archived: false })).filter(
        isUserProjectName
      );
      const savedOrder = loadProjectOrderFromStorage();
      const projects = reconcileProjectOrder(savedOrder, backendProjects);
      persistProjectOrder(projects);

      const currentSelectedProject = state.selectedProject;
      let nextSelectedProject: string | null;

      if (preferredProject && projects.includes(preferredProject)) {
        nextSelectedProject = preferredProject;
      } else if (
        currentSelectedProject &&
        projects.includes(currentSelectedProject)
      ) {
        nextSelectedProject = currentSelectedProject;
      } else {
        nextSelectedProject = findDefaultProject(projects);
      }

      setState((previous) => ({
        ...previous,
        projects,
        selectedProject: nextSelectedProject,
      }));

      if (!nextSelectedProject) {
        reconcileAllProjectRuntimeStates();
        return;
      }
      await Promise.all([
        refreshProjectTree(nextSelectedProject).catch(() => undefined),
        refreshProjectConfig(nextSelectedProject).catch(() => undefined),
      ]);
      reconcileAllProjectRuntimeStates();
    } catch {
      setState((previous) => ({
        ...previous,
        projects: [],
        selectedProject: null,
      }));
    }
  };

  const refreshProjectConfig = async (project: string): Promise<void> => {
    const projectName = project.trim();
    if (!projectName) return;

    const inFlight = projectConfigRefreshByProject.get(projectName);
    if (inFlight) {
      return inFlight;
    }

    const refreshPromise = (async () => {
      setState((previous) => ({
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

        setState((previous) => ({
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
        reconcileProjectRuntimeState(projectName);
      } catch (error) {
        setState((previous) => ({
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
        reconcileProjectRuntimeState(projectName);
        throw error;
      } finally {
        projectConfigRefreshByProject.delete(projectName);
      }
    })();

    projectConfigRefreshByProject.set(projectName, refreshPromise);
    return refreshPromise;
  };

  const createProject = async (name?: string): Promise<string> => {
    const createdPath = await invoke<string>("create_new_project", { name });
    const createdName = extractProjectName(createdPath);

    await loadProjects(createdName ?? undefined);

    const resolvedProject =
      (createdName && state.projects.includes(createdName) ? createdName : null) ??
      state.selectedProject;

    if (!resolvedProject) {
      throw new Error("created project name could not be resolved");
    }

    await Promise.all([
      refreshProjectTree(resolvedProject).catch(() => undefined),
      refreshProjectConfig(resolvedProject).catch(() => undefined),
    ]);
    return resolvedProject;
  };

  const updateProjectConfig = async (
    project: string,
    runtimeHost: string,
    runtimePort: number | null
  ): Promise<ProjectConfigReadSnapshot> => {
    const projectName = project.trim();
    if (!projectName) {
      throw new Error("project is required");
    }

    const normalizedHost = runtimeHost.trim();
    if (!normalizedHost) {
      throw new Error("runtime host is required");
    }

    const normalizedPort = runtimePort != null && Number.isFinite(runtimePort)
      ? Math.trunc(runtimePort)
      : null;

    setState((previous) => ({
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
          runtimeHost: normalizedHost,
          runtimePort: normalizedPort,
        }
      );

      setState((previous) => ({
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
      reconcileProjectRuntimeState(projectName);

      return snapshot;
    } catch (error) {
      setState((previous) => ({
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
      reconcileProjectRuntimeState(projectName);
      throw error;
    }
  };

  const createTerminalSession = (
    project: string,
    label?: string,
    opts?: { playSpawned?: boolean; processRole?: ProcessRole }
  ): TerminalSessionDescriptor => {
    const projectName = project.trim();
    const existing = state.terminalSessionsByProject[projectName] ?? [];
    const defaultLabel = "Shell";
    const resolved = generateUniqueTerminalName(
      existing,
      projectName,
      label?.trim() || defaultLabel
    );

    const descriptor: TerminalSessionDescriptor = {
      terminalId: resolved.terminalId,
      project: projectName,
      displayName: resolved.label,
      customName: null,
      status: "alive" as const,
      hasActiveProcess: false,
      foregroundProcessName: null,
      label: resolved.label,
      createdAt: Date.now(),
      playSpawned: opts?.playSpawned ?? false,
      processRole: opts?.processRole ?? null,
    };

    setState((previous) => {
      const updated = {
        ...previous,
        terminalSessionsByProject: {
          ...previous.terminalSessionsByProject,
          [projectName]: [
            ...(previous.terminalSessionsByProject[projectName] ?? []),
            descriptor,
          ],
        },
      };
      persistTerminalSessions(updated.terminalSessionsByProject);
      return updated;
    });

    return descriptor;
  };

  const removeTerminalSession = (terminalId: string): void => {
    terminalRegistry.destroy(terminalId);
    const affectedProjects: string[] = [];
    setState((previous) => {
      const nextSessionsByProject = { ...previous.terminalSessionsByProject };
      for (const [project, sessions] of Object.entries(nextSessionsByProject)) {
        const filtered = sessions.filter((session) => session.terminalId !== terminalId);
        if (filtered.length === sessions.length) continue;
        affectedProjects.push(project);
        if (filtered.length === 0) {
          delete nextSessionsByProject[project];
        } else {
          nextSessionsByProject[project] = filtered;
        }
      }
      const next = {
        ...previous,
        terminalSessionsByProject: nextSessionsByProject,
      };
      persistTerminalSessions(next.terminalSessionsByProject);
      return next;
    });
    for (const project of affectedProjects) {
      reconcileProjectRuntimeState(project);
    }
    void invoke("terminal_remove_session", { terminalId }).catch(() => undefined);
  };

  const renameTerminalSession = (
    terminalId: string,
    newLabel: string
  ): void => {
    const trimmedLabel = newLabel.trim();
    if (!trimmedLabel) return;
    void invoke("terminal_set_custom_name", {
      terminalId,
      name: trimmedLabel,
    }).catch(() => undefined);
    // Backend event will update state via terminal-session-changed listener
  };

  const renameProject = async (
    oldName: string,
    newName: string
  ): Promise<string> => {
    const trimmedOld = oldName.trim();
    const trimmedNew = newName.trim();
    if (!trimmedOld || !trimmedNew) {
      throw new Error("project name is required");
    }

    const resolvedName = await invoke<string>("rename_project", {
      oldName: trimmedOld,
      newName: trimmedNew,
    });

    // Re-key all state maps from old name to new name
    setState((previous) => {
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
        selectedProject:
          previous.selectedProject === trimmedOld
            ? resolvedName
            : previous.selectedProject,
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

    persistTerminalSessions(state.terminalSessionsByProject);

    // Update persisted project order
    const savedOrder = loadProjectOrderFromStorage();
    persistProjectOrder(savedOrder.map((p) => (p === trimmedOld ? resolvedName : p)));

    await loadProjects(resolvedName);
    return resolvedName;
  };

  const deleteProject = async (project: string): Promise<void> => {
    const projectName = project.trim();
    if (!projectName) return;
    clearPlayStartTimeout(projectName);

    // Destroy all terminal sessions for this project
    terminalRegistry.destroyAllForProject(projectName);

    await invoke("delete_project", { project: projectName });

    setState((previous) => {
      const nextProjectTreeByProject = { ...previous.projectTreeByProject };
      delete nextProjectTreeByProject[projectName];

      const nextProjectTreeLoadingByProject = {
        ...previous.projectTreeLoadingByProject,
      };
      delete nextProjectTreeLoadingByProject[projectName];

      const nextProjectTreeErrorByProject = { ...previous.projectTreeErrorByProject };
      delete nextProjectTreeErrorByProject[projectName];
      const nextProjectConfigSnapshotByProject = {
        ...previous.projectConfigSnapshotByProject,
      };
      delete nextProjectConfigSnapshotByProject[projectName];
      const nextProjectConfigLoadingByProject = {
        ...previous.projectConfigLoadingByProject,
      };
      delete nextProjectConfigLoadingByProject[projectName];
      const nextProjectConfigErrorByProject = {
        ...previous.projectConfigErrorByProject,
      };
      delete nextProjectConfigErrorByProject[projectName];
      const nextFilesystemEventVersionByProject = {
        ...previous.filesystemEventVersionByProject,
      };
      delete nextFilesystemEventVersionByProject[projectName];

      const nextTerminalSessionsByProject = {
        ...previous.terminalSessionsByProject,
      };
      delete nextTerminalSessionsByProject[projectName];
      const nextPlayStateByProject = { ...previous.playStateByProject };
      delete nextPlayStateByProject[projectName];
      const nextPlayErrorByProject = { ...previous.playErrorByProject };
      delete nextPlayErrorByProject[projectName];
      const nextRuntimeProcessHealthyByProject = {
        ...previous.runtimeProcessHealthyByProject,
      };
      delete nextRuntimeProcessHealthyByProject[projectName];

      const next = {
        ...previous,
        selectedProject:
          previous.selectedProject === projectName ? null : previous.selectedProject,
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

    projectTreeRefreshByProject.delete(projectName);
    projectConfigRefreshByProject.delete(projectName);
    await loadProjects();
  };

  const refreshRuntimeSnapshot = async (): Promise<void> => {
    if (runtimeSnapshotRefreshPromise) {
      return runtimeSnapshotRefreshPromise;
    }

    runtimeSnapshotRefreshPromise = (async () => {
      try {
        const snapshot = await invoke<RuntimeDebugSnapshot>("runtime_debug_dump");
        console.debug("[WorkspaceController] runtime_debug_dump", {
          terminals: snapshot.terminalIds.length,
        });
        setState((previous) => ({
          ...previous,
          runtimeDebugSnapshot: snapshot,
          runtimeDebugError: null,
        }));
      } catch (error) {
        setState((previous) => ({
          ...previous,
          runtimeDebugError: toErrorMessage(error),
        }));
        throw error;
      } finally {
        runtimeSnapshotRefreshPromise = null;
      }
    })();

    return runtimeSnapshotRefreshPromise;
  };

  const refreshSharedAssets = async (): Promise<void> => {
    setState((previous) => ({
      ...previous,
      sharedAssetsLoading: true,
      sharedAssetsError: null,
    }));

    try {
      const assets = await invoke<SharedAssetSnapshot[]>("shared_assets_list");
      setState((previous) => ({
        ...previous,
        sharedAssets: assets,
        sharedAssetsLoading: false,
        sharedAssetsError: null,
      }));
    } catch (error) {
      setState((previous) => ({
        ...previous,
        sharedAssetsLoading: false,
        sharedAssetsError: toErrorMessage(error),
      }));
      throw error;
    }
  };

  const uploadSharedAssets = async (files: File[]): Promise<void> => {
    const selectedFiles = files.filter((file) => file.name.trim().length > 0);
    if (selectedFiles.length === 0) return;

    setState((previous) => ({
      ...previous,
      sharedAssetsUploading: true,
      sharedAssetsError: null,
    }));

    try {
      const payload = await Promise.all(
        selectedFiles.map((file) => toSharedAssetUploadPayload(file))
      );
      const assets = await invoke<SharedAssetSnapshot[]>(
        "shared_assets_upload_batch",
        {
          files: payload,
        }
      );

      setState((previous) => ({
        ...previous,
        sharedAssets: assets,
        sharedAssetsError: null,
      }));
    } catch (error) {
      setState((previous) => ({
        ...previous,
        sharedAssetsError: toErrorMessage(error),
      }));
      throw error;
    } finally {
      setState((previous) => ({
        ...previous,
        sharedAssetsUploading: false,
      }));
    }
  };

  const init = async (preferredProject?: string): Promise<void> => {
    if (initPromise) {
      return initPromise;
    }

    if (state.initialized) {
      await loadProjects(preferredProject);
      await refreshRuntimeSnapshot().catch(() => undefined);
      await refreshSharedAssets().catch(() => undefined);
      startRuntimeDebugPolling();
      return;
    }

    initPromise = (async () => {
      await setupListeners();

      const resolvedShellName = await invoke<string>("shell_name").catch(
        () => "zsh"
      );

      // Reconcile terminal sessions from backend
      type BackendSessionInfo = {
        terminalId: string;
        project: string;
        displayName: string;
        customName: string | null;
        status: "alive" | "exited";
        hasActiveProcess: boolean;
        foregroundProcessName: string | null;
        createdAt: number;
        playSpawned: boolean;
        processRole: ProcessRole | null;
      };
      const backendSessions = await invoke<BackendSessionInfo[]>(
        "terminal_get_all_sessions"
      ).catch(() => [] as BackendSessionInfo[]);

      setState((previous) => {
        if (previous.initialized) return previous;

        // Build terminal sessions from backend (authoritative for status)
        const backendByProject: Record<string, TerminalSessionDescriptor[]> = {};
        for (const s of backendSessions) {
          const project = s.project.trim();
          if (!project) continue;
          const descriptor: TerminalSessionDescriptor = {
            terminalId: s.terminalId,
            project,
            displayName: s.displayName,
            customName: s.customName,
            status: s.status,
            hasActiveProcess: s.hasActiveProcess === true,
            foregroundProcessName:
              typeof s.foregroundProcessName === "string"
                ? s.foregroundProcessName
                : null,
            label: s.customName ?? s.displayName,
            createdAt: s.createdAt,
            playSpawned: s.playSpawned ?? false,
            processRole: s.processRole ?? null,
          };
          if (!backendByProject[project]) {
            backendByProject[project] = [];
          }
          backendByProject[project].push(descriptor);
        }

        // Merge: backend is authoritative. Keep localStorage entries
        // only if the terminal doesn't exist in backend (already removed).
        const merged = { ...previous.terminalSessionsByProject };
        for (const [project, sessions] of Object.entries(backendByProject)) {
          merged[project] = sessions;
        }
        // Remove localStorage-only entries that have no backend counterpart
        const backendIds = new Set(backendSessions.map((s) => s.terminalId));
        for (const [project, sessions] of Object.entries(merged)) {
          if (backendByProject[project]) continue;
          // These are localStorage-only entries — backend has no record, so remove
          const filtered = sessions.filter((s) => backendIds.has(s.terminalId));
          if (filtered.length === 0) {
            delete merged[project];
          } else {
            merged[project] = filtered;
          }
        }

        persistTerminalSessions(merged);

        return {
          ...previous,
          initialized: true,
          shellName: resolvedShellName,
          terminalSessionsByProject: merged,
        };
      });

      await loadProjects(preferredProject);
      await refreshRuntimeSnapshot().catch(() => undefined);
      await refreshSharedAssets().catch(() => undefined);
      startRuntimeDebugPolling();
    })().finally(() => {
      initPromise = null;
    });

    return initPromise;
  };

  const getAgentTerminalId = (project: string): string | null => {
    const sessions = state.terminalSessionsByProject[project] ?? [];
    const preferred =
      sessions.find((s) => s.processRole === "agent" && s.status === "alive") ??
      sessions.find((s) => s.processRole === "agent");
    return preferred?.terminalId ?? null;
  };

  const ensureAgentTerminalSession = (project: string): string => {
    const projectName = project.trim();
    if (!projectName) {
      return createTerminalSession(project).terminalId;
    }

    const existing = getAgentTerminalId(projectName);
    if (existing) return existing;

    const descriptor = createTerminalSession(projectName, "agent", {
      processRole: "agent",
    });
    void terminalRegistry
      .acquire(descriptor.terminalId, projectName, { processRole: "agent" })
      .catch(() => undefined);
    return descriptor.terminalId;
  };

  const stopProject = (project: string): void => {
    const projectName = project.trim();
    if (!projectName) return;
    clearPlayStartTimeout(projectName);

    // Kill all terminal sessions (play-spawned and user-created)
    const sessions = state.terminalSessionsByProject[projectName] ?? [];
    for (const session of sessions) {
      removeTerminalSession(session.terminalId);
    }

    setProjectPlayState(projectName, "idle", null);
    reconcileProjectRuntimeState(projectName);
  };

  const playProject = async (project: string): Promise<string | null> => {
    const projectName = project.trim();
    if (!projectName) return null;
    clearPlayStartTimeout(projectName);
    setProjectPlayState(projectName, "starting", null);
    schedulePlayStartTimeout(projectName);
    let playErrorMessage: string | null = null;

    try {
      // Kill all existing play-spawned sessions before launching a new run.
      const sessions = state.terminalSessionsByProject[projectName] ?? [];
      const playSpawnedSessions = sessions.filter((s) => s.playSpawned);
      for (const session of playSpawnedSessions) {
        removeTerminalSession(session.terminalId);
      }

      // Brief tick for cleanup events.
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Refresh config to get the latest configured process map.
      try {
        await refreshProjectConfig(projectName);
      } catch (error) {
        playErrorMessage = `Failed to refresh runtime config: ${toErrorMessage(error)}`;
        throw error;
      }

      const configSnapshot = state.projectConfigSnapshotByProject[projectName];
      const processes = configSnapshot?.processes ?? {};
      const entries = Object.entries(processes);
      if (entries.length === 0) {
        const configPath = configSnapshot?.configPath ?? "runtime config";
        clearPlayStartTimeout(projectName);
        setProjectPlayState(
          projectName,
          "failed",
          `No configured processes found in ${configPath}. Add processes and retry.`
        );
        reconcileProjectRuntimeState(projectName);
        return null;
      }

      let agentTerminalId: string | null = null;
      for (const [label, entry] of entries) {
        const role = entry.role as ProcessRole;
        const descriptor = createTerminalSession(projectName, label, {
          playSpawned: true,
          processRole: role,
        });
        await terminalRegistry.acquire(descriptor.terminalId, projectName, {
          playSpawned: true,
          processRole: role,
        });
        await terminalRegistry.openPty(descriptor.terminalId);
        terminalRegistry.sendCommand(descriptor.terminalId, entry.command);

        if (role === "agent") {
          agentTerminalId = descriptor.terminalId;
        }
      }

      reconcileProjectRuntimeState(projectName);
      return agentTerminalId;
    } catch (error) {
      clearPlayStartTimeout(projectName);
      setProjectPlayState(
        projectName,
        "failed",
        playErrorMessage ??
          `Failed to start configured processes: ${toErrorMessage(error)}`
      );
      reconcileProjectRuntimeState(projectName);
      throw error;
    }
  };

  const reorderProjects = (reordered: string[]): void => {
    persistProjectOrder(reordered);
    setState((previous) => ({
      ...previous,
      projects: reordered,
    }));
  };

  const loadArchivedProjects = async (): Promise<void> => {
    try {
      const archived = (await invoke<string[]>("list_projects", { archived: true })).filter(
        isUserProjectName
      );
      setState((previous) => ({
        ...previous,
        archivedProjects: archived,
      }));
    } catch {
      setState((previous) => ({
        ...previous,
        archivedProjects: [],
      }));
    }
  };

  const archiveProject = async (project: string): Promise<void> => {
    const projectName = project.trim();
    if (!projectName) return;
    clearPlayStartTimeout(projectName);

    // Destroy all frontend terminal sessions
    terminalRegistry.destroyAllForProject(projectName);

    await invoke("archive_project", { project: projectName });

    // Clean all state maps (same pattern as deleteProject)
    setState((previous) => {
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
      const nextRuntimeProcessHealthyByProject = {
        ...previous.runtimeProcessHealthyByProject,
      };
      delete nextRuntimeProcessHealthyByProject[projectName];

      const next = {
        ...previous,
        selectedProject:
          previous.selectedProject === projectName ? null : previous.selectedProject,
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

    projectTreeRefreshByProject.delete(projectName);
    projectConfigRefreshByProject.delete(projectName);
    await loadProjects();
  };

  const unarchiveProject = async (project: string): Promise<void> => {
    const projectName = project.trim();
    if (!projectName) return;

    await invoke("unarchive_project", { project: projectName });
    await loadProjects(projectName);
    await loadArchivedProjects();
  };

  const toggleShowArchived = (): void => {
    const nextShowArchived = !state.showArchived;
    setState((previous) => ({
      ...previous,
      showArchived: nextShowArchived,
    }));
    if (nextShowArchived) {
      void loadArchivedProjects().catch(() => undefined);
    }
  };

  const dispose = async (): Promise<void> => {
    if (initPromise) {
      await initPromise.catch(() => undefined);
    }

    stopRuntimeDebugPolling();
    for (const timeoutId of playStartTimeoutByProject.values()) {
      window.clearTimeout(timeoutId);
    }
    playStartTimeoutByProject.clear();

    const pendingUnlistenFns = unlistenFns;
    unlistenFns = [];

    for (const unlisten of pendingUnlistenFns) {
      try {
        unlisten();
      } catch {
        // Ignore listener disposal errors.
      }
    }

    setState((previous) => {
      if (!previous.initialized) return previous;
      return {
        ...previous,
        initialized: false,
      };
    });
  };

  return {
    getState,
    subscribe,
    init,
    dispose,
    selectProject,
    loadProjects,
    refreshProjectTree,
    refreshProjectConfig,
    createProject,
    refreshSharedAssets,
    uploadSharedAssets,
    updateProjectConfig,
    deleteProject,
    renameProject,
    reorderProjects,
    refreshRuntimeSnapshot,
    createTerminalSession,
    removeTerminalSession,
    renameTerminalSession,
    playProject,
    stopProject,
    getAgentTerminalId,
    ensureAgentTerminalSession,
    loadArchivedProjects,
    archiveProject,
    unarchiveProject,
    toggleShowArchived,
  };
}

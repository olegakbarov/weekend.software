import { invoke } from "@tauri-apps/api/core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { terminalRegistry } from "@/lib/terminal-registry";
import { toErrorMessage } from "@/lib/utils/error";
import {
  type ControllerContext,
  type CreateProjectInput,
  type ProcessRole,
  type ProjectConfigReadSnapshot,
  type TerminalSessionDescriptor,
  type WorkspaceControllerState,
} from "./types";
import { loadTerminalSessionsFromStorage, persistTerminalSessions } from "./persistence";
import {
  type RuntimeInternals,
  appendRuntimeTelemetry,
  clearPlayStartTimeout,
  reconcileProjectRuntimeState,
  refreshRuntimeSnapshot as refreshRuntimeSnapshotImpl,
  resetRuntimeUrlReadiness,
  schedulePlayStartTimeout,
  setProjectPlayState,
  runtimeTelemetryContextForProject,
  startRuntimeDebugPolling,
  stopRuntimeDebugPolling,
} from "./runtime";
import {
  createTerminalSession as createTerminalSessionImpl,
  removeTerminalSession as removeTerminalSessionImpl,
  renameTerminalSession as renameTerminalSessionImpl,
  getAgentTerminalId as getAgentTerminalIdImpl,
  ensureAgentTerminalSession as ensureAgentTerminalSessionImpl,
} from "./terminals";
import {
  type ProjectInternals,
  loadProjects as loadProjectsImpl,
  refreshProjectTree as refreshProjectTreeImpl,
  refreshProjectConfig as refreshProjectConfigImpl,
  createProject as createProjectImpl,
  updateProjectConfig as updateProjectConfigImpl,
  deleteProject as deleteProjectImpl,
  renameProject as renameProjectImpl,
  selectProject as selectProjectImpl,
  reorderProjects as reorderProjectsImpl,
  archiveProject as archiveProjectImpl,
  unarchiveProject as unarchiveProjectImpl,
  loadArchivedProjects as loadArchivedProjectsImpl,
  toggleShowArchived as toggleShowArchivedImpl,
} from "./projects";
import {
  deleteSharedAsset as deleteSharedAssetImpl,
  refreshSharedAssets as refreshSharedAssetsImpl,
  renameSharedAsset as renameSharedAssetImpl,
  uploadSharedAssets as uploadSharedAssetsImpl,
} from "./shared-assets";
import { setupListeners } from "./listeners";
import {
  isAlreadyPortlessWrapped,
  buildPortlessCommand,
  resolvePortlessLaunchPlan,
} from "./portless";

export type {
  PlayState,
  WorkspaceControllerState,
  ProjectTreeNode,
  ProjectConfigReadSnapshot,
  RuntimeDebugSnapshot,
  RuntimeTelemetryEvent,
  SharedAssetSnapshot,
  CreateProjectInput,
  ProcessRole,
  TerminalSessionDescriptor,
  ProcessEntrySnapshot,
  PortlessLaunchPlan,
} from "./types";

export {
  makeTerminalId,
  parseTerminalId,
  terminalDisplayLabel,
} from "./types";

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
    runtimeTelemetryEvents: [],
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
  let initPromise: Promise<void> | null = null;

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

  const ctx: ControllerContext = {
    getState: () => state,
    setState,
  };

  const runtimeInternals: RuntimeInternals = {
    playStartTimeoutByProject: new Map(),
    playStartTimestampByProject: new Map(),
    runtimeUrlProbeIntervalByProject: new Map(),
    runtimeUrlProbeInFlightByProject: new Set(),
    runtimeUrlReadyByProject: new Map(),
    runtimeDebugPollIntervalId: { current: null },
    runtimeSnapshotRefreshPromise: { current: null },
  };

  const projectInternals: ProjectInternals = {
    projectTreeRefreshByProject: new Map(),
    projectConfigRefreshByProject: new Map(),
  };

  const unlistenFns: { current: UnlistenFn[] } = { current: [] };

  const getState = (): WorkspaceControllerState => state;

  const subscribe = (listener: () => void): (() => void) => {
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  };

  const refreshRuntimeSnapshot = () =>
    refreshRuntimeSnapshotImpl(ctx, runtimeInternals);

  const refreshSharedAssets = () => refreshSharedAssetsImpl(ctx);

  const stopProject = (project: string): void => {
    const projectName = project.trim();
    if (!projectName) return;
    clearPlayStartTimeout(runtimeInternals, projectName);
    runtimeInternals.playStartTimestampByProject.delete(projectName);
    resetRuntimeUrlReadiness(runtimeInternals, projectName);

    // Intentionally removes ALL sessions (play-spawned and user-created)
    // to ensure a clean stop with no lingering processes.
    const sessions = state.terminalSessionsByProject[projectName] ?? [];
    for (const session of sessions) {
      removeTerminalSessionImpl(ctx, runtimeInternals, session.terminalId);
    }

    setProjectPlayState(ctx, projectName, "idle", null);
    reconcileProjectRuntimeState(ctx, runtimeInternals, projectName);
  };

  const playProject = async (project: string): Promise<string | null> => {
    const projectName = project.trim();
    if (!projectName) return null;
    clearPlayStartTimeout(runtimeInternals, projectName);
    resetRuntimeUrlReadiness(runtimeInternals, projectName);
    setProjectPlayState(ctx, projectName, "starting", null);
    schedulePlayStartTimeout(ctx, runtimeInternals, projectName);
    runtimeInternals.playStartTimestampByProject.set(projectName, Date.now());
    const initialRuntimeContext = runtimeTelemetryContextForProject(ctx, projectName);
    appendRuntimeTelemetry(ctx, "runtime_play_start", {
      project: projectName,
      runtime_mode: initialRuntimeContext.runtimeMode,
      has_runtime_url: initialRuntimeContext.hasRuntimeUrl,
    });
    let playErrorMessage: string | null = null;

    try {
      const sessions = state.terminalSessionsByProject[projectName] ?? [];
      const playSpawnedSessions = sessions.filter((s) => s.playSpawned);
      for (const session of playSpawnedSessions) {
        removeTerminalSessionImpl(ctx, runtimeInternals, session.terminalId);
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

      try {
        await refreshProjectConfigImpl(ctx, projectInternals, runtimeInternals, projectName);
      } catch (error) {
        playErrorMessage = `Failed to refresh runtime config: ${toErrorMessage(error)}`;
        throw error;
      }

      const configSnapshot = state.projectConfigSnapshotByProject[projectName];
      const runtimeContext = runtimeTelemetryContextForProject(ctx, projectName);
      const processes = configSnapshot?.processes ?? {};
      const entries = Object.entries(processes);
      if (entries.length === 0) {
        const configPath = configSnapshot?.configPath ?? "runtime config";
        runtimeInternals.playStartTimestampByProject.delete(projectName);
        clearPlayStartTimeout(runtimeInternals, projectName);
        resetRuntimeUrlReadiness(runtimeInternals, projectName);
        setProjectPlayState(
          ctx,
          projectName,
          "failed",
          `No configured processes found in ${configPath}. Add processes and retry.`
        );
        appendRuntimeTelemetry(ctx, "runtime_play_failed", {
          project: projectName,
          runtime_mode: runtimeContext.runtimeMode,
          has_runtime_url: runtimeContext.hasRuntimeUrl,
          error_type: "no_processes",
          error_message: `No configured processes found in ${configPath}. Add processes and retry.`,
        });
        reconcileProjectRuntimeState(ctx, runtimeInternals, projectName);
        return null;
      }

      let agentTerminalId: string | null = null;
      for (const [label, entry] of entries) {
        const role = entry.role as ProcessRole;
        const descriptor = createTerminalSessionImpl(ctx, projectName, label, {
          playSpawned: true,
          processRole: role,
        });
        await terminalRegistry.acquire(descriptor.terminalId, projectName, {
          playSpawned: true,
          processRole: role,
        });
        await terminalRegistry.openPty(descriptor.terminalId);
        const launchPlan =
          role === "dev-server"
            ? await resolvePortlessLaunchPlan(projectName, entry.command)
            : null;
        const commandForLaunch = launchPlan?.command ?? entry.command;
        const explicitAppPort = launchPlan?.appPort ?? null;
        const commandToRun =
          role === "dev-server" &&
          !isAlreadyPortlessWrapped(entry.command)
            ? buildPortlessCommand(
                commandForLaunch,
                projectName,
                explicitAppPort
              )
            : entry.command;
        terminalRegistry.sendCommand(descriptor.terminalId, commandToRun);

        if (role === "agent") {
          agentTerminalId = descriptor.terminalId;
        }
      }

      reconcileProjectRuntimeState(ctx, runtimeInternals, projectName);
      return agentTerminalId;
    } catch (error) {
      const context = runtimeTelemetryContextForProject(ctx, projectName);
      const startedAt = runtimeInternals.playStartTimestampByProject.get(projectName);
      const startupMs = typeof startedAt === "number"
        ? Math.max(0, Date.now() - startedAt)
        : null;
      runtimeInternals.playStartTimestampByProject.delete(projectName);
      appendRuntimeTelemetry(ctx, "runtime_play_failed", {
        project: projectName,
        runtime_mode: context.runtimeMode,
        has_runtime_url: context.hasRuntimeUrl,
        error_type: "start_failed",
        error_message:
          playErrorMessage ??
          `Failed to start configured processes: ${toErrorMessage(error)}`,
        startup_ms: startupMs,
      });
      clearPlayStartTimeout(runtimeInternals, projectName);
      resetRuntimeUrlReadiness(runtimeInternals, projectName);
      setProjectPlayState(
        ctx,
        projectName,
        "failed",
        playErrorMessage ??
          `Failed to start configured processes: ${toErrorMessage(error)}`
      );
      reconcileProjectRuntimeState(ctx, runtimeInternals, projectName);
      throw error;
    }
  };

  const init = async (preferredProject?: string): Promise<void> => {
    if (initPromise) {
      return initPromise;
    }

    if (state.initialized) {
      await loadProjectsImpl(ctx, projectInternals, runtimeInternals, preferredProject);
      await refreshRuntimeSnapshot().catch(() => undefined);
      await refreshSharedAssets().catch(() => undefined);
      startRuntimeDebugPolling(runtimeInternals, refreshRuntimeSnapshot);
      return;
    }

    initPromise = (async () => {
      await setupListeners(ctx, projectInternals, runtimeInternals, unlistenFns);

      const resolvedShellName = await invoke<string>("shell_name").catch(
        () => "zsh"
      );

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

        const merged = { ...previous.terminalSessionsByProject };
        for (const [project, sessions] of Object.entries(backendByProject)) {
          merged[project] = sessions;
        }
        const backendIds = new Set(backendSessions.map((s) => s.terminalId));
        for (const [project, sessions] of Object.entries(merged)) {
          if (backendByProject[project]) continue;
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

      await loadProjectsImpl(ctx, projectInternals, runtimeInternals, preferredProject);
      await refreshRuntimeSnapshot().catch(() => undefined);
      await refreshSharedAssets().catch(() => undefined);
      startRuntimeDebugPolling(runtimeInternals, refreshRuntimeSnapshot);
    })().finally(() => {
      initPromise = null;
    });

    return initPromise;
  };

  const dispose = async (): Promise<void> => {
    if (initPromise) {
      await initPromise.catch(() => undefined);
    }

    stopRuntimeDebugPolling(runtimeInternals);
    for (const timeoutId of runtimeInternals.playStartTimeoutByProject.values()) {
      window.clearTimeout(timeoutId);
    }
    runtimeInternals.playStartTimeoutByProject.clear();
    for (const intervalId of runtimeInternals.runtimeUrlProbeIntervalByProject.values()) {
      window.clearInterval(intervalId);
    }
    runtimeInternals.runtimeUrlProbeIntervalByProject.clear();
    runtimeInternals.runtimeUrlProbeInFlightByProject.clear();
    runtimeInternals.runtimeUrlReadyByProject.clear();

    const pendingUnlistenFns = unlistenFns.current;
    unlistenFns.current = [];

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
    selectProject: (project: string | null) =>
      selectProjectImpl(ctx, projectInternals, runtimeInternals, project),
    loadProjects: (preferredProject?: string) =>
      loadProjectsImpl(ctx, projectInternals, runtimeInternals, preferredProject),
    refreshProjectTree: (project: string) =>
      refreshProjectTreeImpl(ctx, projectInternals, project),
    refreshProjectConfig: (project: string) =>
      refreshProjectConfigImpl(ctx, projectInternals, runtimeInternals, project),
    createProject: (input?: CreateProjectInput) =>
      createProjectImpl(ctx, projectInternals, runtimeInternals, input),
    refreshSharedAssets,
    uploadSharedAssets: (files: File[]) => uploadSharedAssetsImpl(ctx, files),
    renameSharedAsset: (fileName: string, newFileName: string) =>
      renameSharedAssetImpl(ctx, fileName, newFileName),
    deleteSharedAsset: (fileName: string) =>
      deleteSharedAssetImpl(ctx, fileName),
    updateProjectConfig: (project: string) =>
      updateProjectConfigImpl(ctx, runtimeInternals, project),
    deleteProject: (project: string) =>
      deleteProjectImpl(ctx, projectInternals, runtimeInternals, project),
    renameProject: (oldName: string, newName: string) =>
      renameProjectImpl(ctx, projectInternals, runtimeInternals, oldName, newName),
    reorderProjects: (reordered: string[]) =>
      reorderProjectsImpl(ctx, reordered),
    refreshRuntimeSnapshot,
    createTerminalSession: (
      project: string,
      label?: string,
      opts?: { playSpawned?: boolean; processRole?: ProcessRole }
    ) => createTerminalSessionImpl(ctx, project, label, opts),
    removeTerminalSession: (terminalId: string) =>
      removeTerminalSessionImpl(ctx, runtimeInternals, terminalId),
    renameTerminalSession: (terminalId: string, newLabel: string) =>
      renameTerminalSessionImpl(ctx, terminalId, newLabel),
    playProject,
    stopProject,
    getAgentTerminalId: (project: string) =>
      getAgentTerminalIdImpl(ctx, project),
    ensureAgentTerminalSession: (project: string) =>
      ensureAgentTerminalSessionImpl(ctx, project),
    loadArchivedProjects: () => loadArchivedProjectsImpl(ctx),
    archiveProject: (project: string) =>
      archiveProjectImpl(ctx, projectInternals, runtimeInternals, project),
    unarchiveProject: (project: string) =>
      unarchiveProjectImpl(ctx, projectInternals, runtimeInternals, project),
    toggleShowArchived: () => toggleShowArchivedImpl(ctx),
  };
}

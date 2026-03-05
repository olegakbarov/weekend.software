import { invoke } from "@tauri-apps/api/core";
import { toErrorMessage } from "@/lib/utils/error";
import {
  type ControllerContext,
  type PlayState,
  type ProcessRole,
  type RuntimeDebugSnapshot,
  type RuntimeTelemetryEvent,
  type TerminalSessionDescriptor,
  MAX_RUNTIME_TELEMETRY_EVENTS,
  PLAY_START_TIMEOUT_MS,
} from "./types";
import {
  isRuntimeReadyHttpStatus,
  resolveRuntimePlayState,
} from "./runtime-play-state";

const RUNTIME_READY_POLL_INTERVAL_MS = 350;

type RuntimeUrlProbeResult = {
  ok: boolean;
  reachable: boolean;
  status: number | null;
};

function isRuntimeProcessRole(role: ProcessRole | null): boolean {
  return role === "dev-server" || role === "service";
}

function isDevServerProcessRole(role: ProcessRole | null): boolean {
  return role === "dev-server";
}

export function hasHealthyProcessForProject(
  sessionsByProject: Record<string, TerminalSessionDescriptor[]>,
  project: string,
  roleMatcher: (role: ProcessRole | null) => boolean
): boolean {
  return (sessionsByProject[project] ?? []).some(
    (session) =>
      session.playSpawned &&
      session.status === "alive" &&
      session.hasActiveProcess &&
      roleMatcher(session.processRole)
  );
}

export function hasHealthyRuntimeProcessForProject(
  sessionsByProject: Record<string, TerminalSessionDescriptor[]>,
  project: string
): boolean {
  return hasHealthyProcessForProject(
    sessionsByProject,
    project,
    isRuntimeProcessRole
  );
}

export function hasHealthyDevServerProcessForProject(
  sessionsByProject: Record<string, TerminalSessionDescriptor[]>,
  project: string
): boolean {
  return hasHealthyProcessForProject(
    sessionsByProject,
    project,
    isDevServerProcessRole
  );
}

function normalizeRuntimeModeForTelemetry(
  mode: string | null | undefined
): "portless" | "unknown" {
  const normalized = (mode ?? "").trim().toLowerCase();
  if (normalized === "") return "portless";
  if (normalized === "portless") return "portless";
  return "unknown";
}

export type RuntimeInternals = {
  playStartTimeoutByProject: Map<string, number>;
  playStartTimestampByProject: Map<string, number>;
  runtimeUrlProbeIntervalByProject: Map<string, number>;
  runtimeUrlProbeInFlightByProject: Set<string>;
  runtimeUrlReadyByProject: Map<string, boolean>;
  runtimeDebugPollIntervalId: { current: number | null };
  runtimeSnapshotRefreshPromise: { current: Promise<void> | null };
};

export function appendRuntimeTelemetry(
  ctx: ControllerContext,
  event: string,
  payload: Record<string, unknown>
): void {
  const atUnixMs = Date.now();
  const entry: RuntimeTelemetryEvent = {
    id: `${atUnixMs}-${Math.random().toString(36).slice(2, 10)}`,
    event,
    atUnixMs,
    payload,
  };

  console.info(
    "[runtime.telemetry]",
    JSON.stringify({
      event,
      atUnixMs,
      ...payload,
    })
  );

  ctx.setState((previous) => {
    const nextEvents = [...previous.runtimeTelemetryEvents, entry];
    const trimmed = nextEvents.slice(
      Math.max(0, nextEvents.length - MAX_RUNTIME_TELEMETRY_EVENTS)
    );
    return {
      ...previous,
      runtimeTelemetryEvents: trimmed,
    };
  });
}

export function clearPlayStartTimeout(
  internals: RuntimeInternals,
  project: string
): void {
  const timeoutId = internals.playStartTimeoutByProject.get(project);
  if (timeoutId == null) return;
  window.clearTimeout(timeoutId);
  internals.playStartTimeoutByProject.delete(project);
}

function clearRuntimeUrlProbeInterval(
  internals: RuntimeInternals,
  project: string
): void {
  const intervalId = internals.runtimeUrlProbeIntervalByProject.get(project);
  if (intervalId != null) {
    window.clearInterval(intervalId);
    internals.runtimeUrlProbeIntervalByProject.delete(project);
  }
  internals.runtimeUrlProbeInFlightByProject.delete(project);
}

export function resetRuntimeUrlReadiness(
  internals: RuntimeInternals,
  project: string
): void {
  clearRuntimeUrlProbeInterval(internals, project);
  internals.runtimeUrlReadyByProject.delete(project);
}

export function setProjectPlayState(
  ctx: ControllerContext,
  project: string,
  nextState: PlayState,
  errorMessage: string | null
): void {
  ctx.setState((previous) => {
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
}

export function runtimeTelemetryContextForProject(
  ctx: ControllerContext,
  project: string
): { runtimeMode: "portless" | "unknown"; hasRuntimeUrl: boolean } {
  const snapshot = ctx.getState().projectConfigSnapshotByProject[project];
  return {
    runtimeMode: normalizeRuntimeModeForTelemetry(snapshot?.runtimeMode),
    hasRuntimeUrl: (snapshot?.runtimeUrl?.trim() ?? "").length > 0,
  };
}

function runtimeUrlForProject(
  ctx: ControllerContext,
  project: string
): string | null {
  const snapshot = ctx.getState().projectConfigSnapshotByProject[project];
  if (!snapshot?.configValid) return null;
  const runtimeUrl = snapshot.runtimeUrl?.trim() ?? "";
  return runtimeUrl.length > 0 ? runtimeUrl : null;
}

async function probeRuntimeUrlReadiness(
  ctx: ControllerContext,
  internals: RuntimeInternals,
  project: string
): Promise<void> {
  if (internals.runtimeUrlProbeInFlightByProject.has(project)) {
    return;
  }

  const runtimeUrl = runtimeUrlForProject(ctx, project);
  if (!runtimeUrl) {
    clearRuntimeUrlProbeInterval(internals, project);
    return;
  }
  if (runtimeUrl.startsWith("https://")) {
    internals.runtimeUrlReadyByProject.set(project, true);
    reconcileProjectRuntimeState(ctx, internals, project);
    return;
  }

  internals.runtimeUrlProbeInFlightByProject.add(project);
  try {
    const result = await invoke<RuntimeUrlProbeResult>("probe_runtime_url", {
      url: runtimeUrl,
    });
    const currentState = ctx.getState();
    const currentPlayState = currentState.playStateByProject[project] ?? "idle";
    const runtimeHealthy =
      currentState.runtimeProcessHealthyByProject[project] ?? false;
    const currentRuntimeUrl = runtimeUrlForProject(ctx, project);
    if (
      currentPlayState !== "starting" ||
      !runtimeHealthy ||
      currentRuntimeUrl !== runtimeUrl
    ) {
      return;
    }
    if (!isRuntimeReadyHttpStatus(result.status) || result.ok !== true) {
      return;
    }

    internals.runtimeUrlReadyByProject.set(project, true);
    reconcileProjectRuntimeState(ctx, internals, project);
  } catch {
    // Runtime probes are expected to fail while the local server is booting.
  } finally {
    internals.runtimeUrlProbeInFlightByProject.delete(project);
  }
}

function syncRuntimeUrlPolling(
  ctx: ControllerContext,
  internals: RuntimeInternals,
  project: string
): void {
  const state = ctx.getState();
  const currentPlayState = state.playStateByProject[project] ?? "idle";
  const runtimeHealthy = state.runtimeProcessHealthyByProject[project] ?? false;
  const runtimeUrl = runtimeUrlForProject(ctx, project);
  const runtimeUrlReady = internals.runtimeUrlReadyByProject.get(project) === true;
  const shouldPoll =
    currentPlayState === "starting" &&
    runtimeHealthy &&
    !!runtimeUrl &&
    !runtimeUrlReady;

  if (!shouldPoll) {
    clearRuntimeUrlProbeInterval(internals, project);
    return;
  }

  if (internals.runtimeUrlProbeIntervalByProject.has(project)) {
    return;
  }

  const intervalId = window.setInterval(() => {
    void probeRuntimeUrlReadiness(ctx, internals, project);
  }, RUNTIME_READY_POLL_INTERVAL_MS);
  internals.runtimeUrlProbeIntervalByProject.set(project, intervalId);
  void probeRuntimeUrlReadiness(ctx, internals, project);
}

export function reconcileProjectRuntimeState(
  ctx: ControllerContext,
  internals: RuntimeInternals,
  project: string
): void {
  let transitionedFromStartingToRunning = false;
  let transitionedFromRunningToFailed = false;
  let failedReason: string | null = null;
  ctx.setState((previous) => {
    const configuredProcesses =
      previous.projectConfigSnapshotByProject[project]?.processes ?? {};
    const expectsDevServer = Object.values(configuredProcesses).some(
      (entry) => entry.role === "dev-server"
    );
    const runtimeHealthy = expectsDevServer
      ? hasHealthyDevServerProcessForProject(
          previous.terminalSessionsByProject,
          project
        )
      : hasHealthyRuntimeProcessForProject(
          previous.terminalSessionsByProject,
          project
        );
    const runtimeUrlReady =
      internals.runtimeUrlReadyByProject.get(project) === true;
    const currentHealthy =
      previous.runtimeProcessHealthyByProject[project] ?? false;
    const currentPlayState = previous.playStateByProject[project] ?? "idle";
    const currentError = previous.playErrorByProject[project] ?? null;
    const {
      nextPlayState,
      nextError,
      transitionedFromStartingToRunning: startedRunning,
      transitionedFromRunningToFailed: runningFailed,
      failedReason: nextFailedReason,
    } = resolveRuntimePlayState({
      currentPlayState,
      currentError,
      runtimeHealthy,
      runtimeUrlReady,
    });

    if (startedRunning) {
      clearPlayStartTimeout(internals, project);
      clearRuntimeUrlProbeInterval(internals, project);
    }

    transitionedFromStartingToRunning = startedRunning;
    transitionedFromRunningToFailed = runningFailed;
    failedReason = nextFailedReason;

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

  syncRuntimeUrlPolling(ctx, internals, project);

  if (transitionedFromStartingToRunning) {
    const context = runtimeTelemetryContextForProject(ctx, project);
    const startedAt = internals.playStartTimestampByProject.get(project);
    const startupMs =
      typeof startedAt === "number" ? Math.max(0, Date.now() - startedAt) : null;
    internals.playStartTimestampByProject.delete(project);
    appendRuntimeTelemetry(ctx, "runtime_play_ready", {
      project,
      runtime_mode: context.runtimeMode,
      has_runtime_url: context.hasRuntimeUrl,
      startup_ms: startupMs,
    });
  }

  if (transitionedFromRunningToFailed) {
    const context = runtimeTelemetryContextForProject(ctx, project);
    internals.playStartTimestampByProject.delete(project);
    appendRuntimeTelemetry(ctx, "runtime_play_failed", {
      project,
      runtime_mode: context.runtimeMode,
      has_runtime_url: context.hasRuntimeUrl,
      error_type: "runtime_process_unhealthy",
      error_message: failedReason,
    });
  }
}

export function schedulePlayStartTimeout(
  ctx: ControllerContext,
  internals: RuntimeInternals,
  project: string
): void {
  clearPlayStartTimeout(internals, project);
  const timeoutId = window.setTimeout(() => {
    internals.playStartTimeoutByProject.delete(project);
    resetRuntimeUrlReadiness(internals, project);
    let timedOut = false;
    ctx.setState((previous) => {
      const current = previous.playStateByProject[project] ?? "idle";
      if (current !== "starting") return previous;
      timedOut = true;
      return {
        ...previous,
        playStateByProject: {
          ...previous.playStateByProject,
          [project]: "failed",
        },
        playErrorByProject: {
          ...previous.playErrorByProject,
          [project]: "Startup timed out before the runtime endpoint became ready.",
        },
      };
    });
    if (timedOut) {
      const context = runtimeTelemetryContextForProject(ctx, project);
      internals.playStartTimestampByProject.delete(project);
      appendRuntimeTelemetry(ctx, "runtime_play_failed", {
        project,
        runtime_mode: context.runtimeMode,
        has_runtime_url: context.hasRuntimeUrl,
        error_type: "startup_timeout",
        error_message:
          "Startup timed out before the runtime endpoint became ready.",
      });
    }
  }, PLAY_START_TIMEOUT_MS);
  internals.playStartTimeoutByProject.set(project, timeoutId);
}

export function reconcileAllProjectRuntimeStates(
  ctx: ControllerContext,
  internals: RuntimeInternals
): void {
  const state = ctx.getState();
  const projects = new Set<string>([
    ...state.projects,
    ...Object.keys(state.terminalSessionsByProject),
    ...Object.keys(state.playStateByProject),
  ]);
  for (const project of projects) {
    reconcileProjectRuntimeState(ctx, internals, project);
  }
}

export function startRuntimeDebugPolling(
  internals: RuntimeInternals,
  refreshRuntimeSnapshot: () => Promise<void>
): void {
  if (internals.runtimeDebugPollIntervalId.current !== null) return;
  internals.runtimeDebugPollIntervalId.current = window.setInterval(() => {
    void refreshRuntimeSnapshot().catch(() => undefined);
  }, 2000);
}

export function stopRuntimeDebugPolling(internals: RuntimeInternals): void {
  if (internals.runtimeDebugPollIntervalId.current === null) return;
  window.clearInterval(internals.runtimeDebugPollIntervalId.current);
  internals.runtimeDebugPollIntervalId.current = null;
}

export function refreshRuntimeSnapshot(
  ctx: ControllerContext,
  internals: RuntimeInternals
): Promise<void> {
  if (internals.runtimeSnapshotRefreshPromise.current) {
    return internals.runtimeSnapshotRefreshPromise.current;
  }

  internals.runtimeSnapshotRefreshPromise.current = (async () => {
    try {
      const snapshot = await invoke<RuntimeDebugSnapshot>("runtime_debug_dump");
      console.debug("[WorkspaceController] runtime_debug_dump", {
        terminals: snapshot.terminalIds.length,
      });
      ctx.setState((previous) => ({
        ...previous,
        runtimeDebugSnapshot: snapshot,
        runtimeDebugError: null,
      }));
    } catch (error) {
      ctx.setState((previous) => ({
        ...previous,
        runtimeDebugError: toErrorMessage(error),
      }));
      throw error;
    } finally {
      internals.runtimeSnapshotRefreshPromise.current = null;
    }
  })();

  return internals.runtimeSnapshotRefreshPromise.current;
}

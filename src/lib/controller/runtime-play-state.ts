import type { PlayState } from "./types";

export type RuntimePlayStateResolution = {
  nextPlayState: PlayState;
  nextError: string | null;
  transitionedFromStartingToRunning: boolean;
  transitionedFromRunningToFailed: boolean;
  failedReason: string | null;
};

export function isRuntimeReadyHttpStatus(status: number | null): boolean {
  return typeof status === "number" && status >= 200 && status < 400;
}

export function resolveRuntimePlayState({
  currentPlayState,
  currentError,
  runtimeHealthy,
  runtimeUrlReady,
}: {
  currentPlayState: PlayState;
  currentError: string | null;
  runtimeHealthy: boolean;
  runtimeUrlReady: boolean;
}): RuntimePlayStateResolution {
  let nextPlayState = currentPlayState;
  let nextError = currentError;
  let transitionedFromStartingToRunning = false;
  let transitionedFromRunningToFailed = false;
  let failedReason: string | null = null;

  if (currentPlayState === "starting") {
    if (runtimeHealthy && runtimeUrlReady) {
      nextPlayState = "running";
      nextError = null;
      transitionedFromStartingToRunning = true;
    }
  } else if (currentPlayState === "running") {
    if (!runtimeHealthy) {
      nextPlayState = "failed";
      nextError = "Configured runtime process is not healthy.";
      transitionedFromRunningToFailed = true;
      failedReason = nextError;
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

  return {
    nextPlayState,
    nextError,
    transitionedFromStartingToRunning,
    transitionedFromRunningToFailed,
    failedReason,
  };
}

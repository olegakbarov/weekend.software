import test from "node:test";
import assert from "node:assert/strict";
import {
  isRuntimeReadyHttpStatus,
  resolveRuntimePlayState,
} from "./runtime-play-state.ts";

test("starting projects stay in loading until the runtime URL is ready", () => {
  const unresolved = resolveRuntimePlayState({
    currentPlayState: "starting",
    currentError: null,
    runtimeHealthy: true,
    runtimeUrlReady: false,
  });

  assert.equal(unresolved.nextPlayState, "starting");
  assert.equal(unresolved.nextError, null);
  assert.equal(unresolved.transitionedFromStartingToRunning, false);

  const resolved = resolveRuntimePlayState({
    currentPlayState: "starting",
    currentError: null,
    runtimeHealthy: true,
    runtimeUrlReady: true,
  });

  assert.equal(resolved.nextPlayState, "running");
  assert.equal(resolved.nextError, null);
  assert.equal(resolved.transitionedFromStartingToRunning, true);
});

test("runtime readiness treats startup error pages as not-ready", () => {
  assert.equal(isRuntimeReadyHttpStatus(200), true);
  assert.equal(isRuntimeReadyHttpStatus(302), true);
  assert.equal(isRuntimeReadyHttpStatus(404), false);
  assert.equal(isRuntimeReadyHttpStatus(500), false);
  assert.equal(isRuntimeReadyHttpStatus(null), false);
});

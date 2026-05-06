import assert from "node:assert/strict";
import test from "node:test";
import {
  removeProjectState,
  renameProjectState,
  resolveFocusedProject,
} from "./project-state.ts";
import type { WorkspaceControllerState } from "./types.ts";

function makeState(): WorkspaceControllerState {
  return {
    initialized: true,
    shellName: "zsh",
    projects: ["alpha", "beta"],
    focusedProject: "alpha",
    projectTreeByProject: { alpha: [], beta: [] },
    projectTreeLoadingByProject: { alpha: true, beta: false },
    projectTreeErrorByProject: { alpha: null, beta: "boom" },
    projectConfigSnapshotByProject: { alpha: null, beta: null },
    projectConfigLoadingByProject: { alpha: false, beta: true },
    projectConfigErrorByProject: { alpha: null, beta: null },
    filesystemEventVersion: 2,
    filesystemEventVersionByProject: { alpha: 1, beta: 2 },
    runtimeDebugSnapshot: null,
    runtimeDebugError: null,
    runtimeTelemetryEvents: [],
    terminalSessionsByProject: {
      alpha: [
        {
          terminalId: "alpha:Shell",
          project: "alpha",
          displayName: "Shell",
          customName: null,
          status: "alive",
          hasActiveProcess: false,
          foregroundProcessName: null,
          label: "Shell",
          createdAt: 1,
          playSpawned: false,
          processRole: null,
        },
      ],
      beta: [],
    },
    playStateByProject: { alpha: "running", beta: "idle" },
    playErrorByProject: { alpha: null, beta: null },
    runtimeProcessHealthyByProject: { alpha: true, beta: false },
    archivedProjects: ["archive-me", "alpha"],
    showArchived: true,
    sharedAssets: [],
    sharedAssetsLoading: false,
    sharedAssetsError: null,
    sharedAssetsUploading: false,
    sharedEnv: {},
    sharedEnvLoading: false,
    sharedEnvError: null,
  };
}

test("resolveFocusedProject prefers explicit project, then current, then first project", () => {
  assert.equal(
    resolveFocusedProject({
      projects: ["alpha", "beta"],
      currentFocusedProject: "beta",
      preferredProject: "alpha",
    }),
    "alpha"
  );
  assert.equal(
    resolveFocusedProject({
      projects: ["alpha", "beta"],
      currentFocusedProject: "beta",
      preferredProject: "missing",
    }),
    "beta"
  );
  assert.equal(
    resolveFocusedProject({
      projects: ["alpha", "beta"],
      currentFocusedProject: "missing",
    }),
    "alpha"
  );
});

test("renameProjectState rekeys project-scoped maps and archived list", () => {
  const renamed = renameProjectState(makeState(), "alpha", "gamma");

  assert.deepEqual(renamed.projects, ["gamma", "beta"]);
  assert.equal(renamed.focusedProject, "gamma");
  assert.ok("gamma" in renamed.projectTreeByProject);
  assert.ok(!("alpha" in renamed.projectTreeByProject));
  assert.ok("gamma" in renamed.terminalSessionsByProject);
  assert.ok(!("alpha" in renamed.terminalSessionsByProject));
  assert.equal(renamed.terminalSessionsByProject.gamma[0]?.project, "gamma");
  assert.equal(
    renamed.terminalSessionsByProject.gamma[0]?.terminalId,
    "gamma:Shell"
  );
  assert.deepEqual(renamed.archivedProjects, ["archive-me", "gamma"]);
});

test("removeProjectState drops project-scoped maps and clears focused project", () => {
  const removed = removeProjectState(makeState(), "alpha");

  assert.equal(removed.focusedProject, null);
  assert.ok(!("alpha" in removed.projectTreeByProject));
  assert.ok(!("alpha" in removed.terminalSessionsByProject));
  assert.ok(!("alpha" in removed.playStateByProject));
  assert.deepEqual(removed.archivedProjects, ["archive-me"]);
});

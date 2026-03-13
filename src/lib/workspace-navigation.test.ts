import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWorkspaceLocation,
  isTerminalOwnedByProject,
  type WorkspaceSearch,
} from "./workspace-navigation.ts";

test("buildWorkspaceLocation preserves the current project route when switching views", () => {
  const search: WorkspaceSearch = { view: "editor" };

  assert.deepEqual(buildWorkspaceLocation("demo", search), {
    to: "/workspace/$project",
    params: { project: "demo" },
    search,
  });
});

test("buildWorkspaceLocation keeps terminal ids for terminal views", () => {
  const search: WorkspaceSearch = {
    view: "terminal",
    terminalId: "demo-agent",
  };

  assert.deepEqual(buildWorkspaceLocation("demo", search), {
    to: "/workspace/$project",
    params: { project: "demo" },
    search,
  });
});

test("isTerminalOwnedByProject accepts terminal ids from the active project", () => {
  assert.equal(isTerminalOwnedByProject("sports", "sports:agent"), true);
});

test("isTerminalOwnedByProject rejects terminal ids from another project", () => {
  assert.equal(isTerminalOwnedByProject("sports", "home:agent"), false);
  assert.equal(isTerminalOwnedByProject("sports", null), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  findAliveAgentSession,
  shouldStopWithRuntimeLifecycle,
} from "./terminal-lifecycle.ts";
import type { ProcessRole, TerminalSessionDescriptor } from "./types.ts";

function session(
  overrides: Partial<TerminalSessionDescriptor> = {}
): TerminalSessionDescriptor {
  const role = overrides.processRole ?? null;
  const label = role ?? "Shell";
  return {
    terminalId: `alpha:${label}`,
    project: "alpha",
    displayName: label,
    customName: null,
    status: "alive",
    hasActiveProcess: true,
    foregroundProcessName: null,
    label,
    createdAt: 1,
    playSpawned: false,
    processRole: role as ProcessRole | null,
    agentProfileId: null,
    agentInstanceId: null,
    agentProvider: null,
    agentSessionId: null,
    ...overrides,
  };
}

test("runtime lifecycle stops only play-spawned non-agent sessions", () => {
  assert.equal(
    shouldStopWithRuntimeLifecycle(
      session({ playSpawned: true, processRole: "dev-server" })
    ),
    true
  );
  assert.equal(
    shouldStopWithRuntimeLifecycle(
      session({ playSpawned: true, processRole: "service" })
    ),
    true
  );
  assert.equal(
    shouldStopWithRuntimeLifecycle(
      session({ playSpawned: true, processRole: "agent" })
    ),
    false
  );
  assert.equal(
    shouldStopWithRuntimeLifecycle(
      session({ playSpawned: false, processRole: null })
    ),
    false
  );
});

test("agent lookup ignores exited agent sessions", () => {
  const aliveAgent = session({
    terminalId: "alpha:agent 2",
    processRole: "agent",
  });

  assert.equal(
    findAliveAgentSession([
      session({
        terminalId: "alpha:agent",
        processRole: "agent",
        status: "exited",
      }),
      session({ terminalId: "alpha:dev", processRole: "dev-server" }),
      aliveAgent,
    ]),
    aliveAgent
  );
});

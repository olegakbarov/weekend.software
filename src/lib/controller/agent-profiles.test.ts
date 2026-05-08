import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_AGENT_PROFILES,
  normalizeAgentSettings,
} from "./agent-profiles.ts";

test("default profiles include Claude Code skip-permissions launch command", () => {
  const profile = DEFAULT_AGENT_PROFILES.find(
    (candidate) => candidate.id === "claude-skip-permissions"
  );

  assert.equal(profile?.label, "Claude Code (skip permissions)");
  assert.equal(profile?.provider, "claude-code");
  assert.equal(profile?.command, "claude --dangerously-skip-permissions");
  assert.equal(profile?.sessionIdStrategy, "preseed-uuid");
});

test("normalization preserves edited built-in agent commands", () => {
  const settings = normalizeAgentSettings({
    defaultProfileId: "claude",
    profiles: [
      {
        id: "claude",
        label: "Claude Code",
        provider: "claude-code",
        command: "claude --dangerously-skip-permissions",
        sessionIdStrategy: "preseed-uuid",
        resumeCommand: "claude --resume {{sessionId}}",
      },
    ],
  });

  assert.equal(settings.defaultProfileId, "claude");
  assert.equal(
    settings.profiles.find((profile) => profile.id === "claude")?.command,
    "claude --dangerously-skip-permissions"
  );
});

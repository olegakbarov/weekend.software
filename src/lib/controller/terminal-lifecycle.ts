import type { TerminalSessionDescriptor } from "./types";

type TerminalLifecycleFields = Pick<
  TerminalSessionDescriptor,
  "playSpawned" | "processRole"
>;

export function shouldStopWithRuntimeLifecycle(
  session: TerminalLifecycleFields
): boolean {
  return session.playSpawned && session.processRole !== "agent";
}

export function findAliveAgentSession(
  sessions: TerminalSessionDescriptor[]
): TerminalSessionDescriptor | null {
  return sessions.find(
    (session) => session.processRole === "agent" && session.status === "alive"
  ) ?? null;
}

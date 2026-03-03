export type ProcessRole = "dev-server" | "agent" | "service";

export type ProcessEntrySnapshot = {
  command: string;
  role: ProcessRole;
};

export type TerminalSessionDescriptor = {
  terminalId: string;
  project: string;
  displayName: string;
  customName: string | null;
  status: "alive" | "exited";
  hasActiveProcess: boolean;
  foregroundProcessName: string | null;
  label: string;
  createdAt: number;
  playSpawned: boolean;
  processRole: ProcessRole | null;
};

export function terminalDisplayLabel(desc: TerminalSessionDescriptor): string {
  return desc.customName ?? desc.displayName;
}

export type ProjectView =
  | { kind: "browser" }
  | { kind: "terminal"; terminalId: string }
  | { kind: "editor" }
  | { kind: "settings" };

export type ActiveView =
  | { route: "workspace"; project: string; view: ProjectView }
  | { route: "settings" }
  | { route: "logs" };

export function makeTerminalId(project: string, label: string): string {
  return `${project}:${label}`;
}

export function parseTerminalId(terminalId: string): {
  project: string;
  label: string;
} | null {
  const colonIndex = terminalId.indexOf(":");
  if (colonIndex < 0) return null;
  return {
    project: terminalId.slice(0, colonIndex),
    label: terminalId.slice(colonIndex + 1),
  };
}

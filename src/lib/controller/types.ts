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

export type ProjectTreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  children: ProjectTreeNode[];
};

export type RuntimeDebugSnapshot = {
  generatedAtUnixMs: number;
  terminalIds: string[];
};

export type RuntimeTelemetryEvent = {
  id: string;
  event: string;
  atUnixMs: number;
  payload: Record<string, unknown>;
};

export type ProjectConfigReadSnapshot = {
  project: string;
  projectDir: string;
  configPath: string;
  configExists: boolean;
  configValid: boolean;
  runtimeMode?: string | null;
  runtimeUrl?: string | null;
  startupCommands: string[];
  processes: Record<string, ProcessEntrySnapshot>;
  source: string;
  error: string | null;
};

export type SharedAssetSnapshot = {
  fileName: string;
  sizeBytes: number;
  modifiedAtUnixMs: number | null;
};

export type CreateProjectInput = {
  name?: string;
  defaultAgentCommand?: string;
  githubRepoUrl?: string;
};

export type SharedAssetUploadInput = {
  fileName: string;
  dataBase64: string;
};

export type ProjectTreeChangedPayload = {
  project: string;
};

export type PortlessLaunchPlan = {
  command: string;
  appPort: number | null;
};

export type PlayState = "idle" | "starting" | "running" | "failed";

export type WorkspaceControllerState = {
  initialized: boolean;
  shellName: string;
  projects: string[];
  focusedProject: string | null;
  projectTreeByProject: Record<string, ProjectTreeNode[]>;
  projectTreeLoadingByProject: Record<string, boolean>;
  projectTreeErrorByProject: Record<string, string | null>;
  projectConfigSnapshotByProject: Record<string, ProjectConfigReadSnapshot | null>;
  projectConfigLoadingByProject: Record<string, boolean>;
  projectConfigErrorByProject: Record<string, string | null>;
  filesystemEventVersion: number;
  filesystemEventVersionByProject: Record<string, number>;
  runtimeDebugSnapshot: RuntimeDebugSnapshot | null;
  runtimeDebugError: string | null;
  runtimeTelemetryEvents: RuntimeTelemetryEvent[];
  terminalSessionsByProject: Record<string, TerminalSessionDescriptor[]>;
  playStateByProject: Record<string, PlayState>;
  playErrorByProject: Record<string, string | null>;
  runtimeProcessHealthyByProject: Record<string, boolean>;
  archivedProjects: string[];
  showArchived: boolean;
  sharedAssets: SharedAssetSnapshot[];
  sharedAssetsLoading: boolean;
  sharedAssetsError: string | null;
  sharedAssetsUploading: boolean;
};

export const RESERVED_PROJECT_NAMES = new Set(["logs", "shared-assets"]);
export const MAX_RUNTIME_TELEMETRY_EVENTS = 200;
export const PLAY_START_TIMEOUT_MS = 20000;
export const PORTLESS_APP_PORT_MIN = 43000;
export const PORTLESS_APP_PORT_MAX = 49999;
export const TERMINAL_SESSIONS_STORAGE_KEY = "weekend.terminal-sessions-by-project.v1";
export const PROJECT_ORDER_STORAGE_KEY = "weekend.project-order.v1";

export function isUserProjectName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return !RESERVED_PROJECT_NAMES.has(trimmed.toLowerCase());
}

export type ControllerContext = {
  getState: () => WorkspaceControllerState;
  setState: (updater: (prev: WorkspaceControllerState) => WorkspaceControllerState) => void;
};

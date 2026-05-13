export type ProcessRole = "dev-server" | "agent" | "agent-spawned" | "service";

export type AgentProvider = "claude-code" | "codex" | "custom";

export type AgentSessionIdStrategy =
  | "preseed-uuid"
  | "hook-json"
  | "stdout-json"
  | "stdout-regex"
  | "filesystem"
  | "none";

export type AgentProfile = {
  id: string;
  label: string;
  provider: AgentProvider;
  command: string;
  sessionIdStrategy: AgentSessionIdStrategy;
  resumeCommand?: string | null;
};

export type AgentSettings = {
  profiles: AgentProfile[];
  defaultProfileId: string;
};

export type ProcessEntrySnapshot = {
  command: string;
  role: ProcessRole;
};

export type ProjectAgentsConfigSnapshot = {
  default?: string | null;
};

export type ProjectThemeConfigSnapshot = {
  trackShell: boolean;
  designSystem?: DesignSystemChoice | string | null;
  deploy?: DeployChoice | string | null;
  cssVariables?: Record<string, string>;
  themeVariables?: Record<string, Record<string, string>>;
};

export type ShapeVariant = "pill" | "rounded";

export type DesignSystemConfigSnapshot = {
  version: number;
  shape: ShapeVariant;
  cssVariables?: Record<string, string>;
  themeVariables?: Record<string, Record<string, string>>;
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
  agentProfileId: string | null;
  agentInstanceId: string | null;
  agentProvider: AgentProvider | string | null;
  agentSessionId: string | null;
};

export type AgentLaunchMetadata = {
  profileId: string;
  instanceId: string;
  provider: AgentProvider | string;
  sessionId: string | null;
  command: string | null;
};

const DEFAULT_TERMINAL_LABEL = "Shell";

export function terminalDisplayLabel(desc: TerminalSessionDescriptor): string {
  if (desc.customName) return desc.customName;
  if (desc.label && desc.label !== DEFAULT_TERMINAL_LABEL) return desc.label;
  return desc.displayName;
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
  deployUrl?: string | null;
  startupCommands: string[];
  processes: Record<string, ProcessEntrySnapshot>;
  agents?: ProjectAgentsConfigSnapshot | null;
  env: Record<string, string>;
  theme: ProjectThemeConfigSnapshot;
  source: string;
  error: string | null;
};

export type SharedAssetSnapshot = {
  fileName: string;
  sizeBytes: number;
  modifiedAtUnixMs: number | null;
};

export type DesignSystemChoice = "weekend" | "none";

export type DeployChoice = "none" | "cloudflare" | "vercel";

export type CreateProjectInput = {
  name?: string;
  defaultAgentCommand?: string;
  defaultAgentProfileId?: string;
  githubRepoUrl?: string;
  initialPrompt?: string;
  designSystem?: DesignSystemChoice;
  deploy?: DeployChoice;
  fileWrites?: Record<string, string>;
};

export type PresetWriteTarget =
  | { type: "env.local"; as?: string }
  | { type: "config"; path: string }
  | { type: "transient" };

export type PresetFieldValidation = {
  pattern?: string;
  minLength?: number;
};

export type PresetField = {
  key: string;
  label: string;
  description?: string;
  placeholder?: string;
  helpUrl?: string;
  required: boolean;
  secret: boolean;
  writesTo: PresetWriteTarget;
  validate?: PresetFieldValidation;
};

export type PresetDerived = {
  key: string;
  template: string;
  writesTo: PresetWriteTarget;
};

export type PresetAfterCreateStep = {
  label: string;
  command?: string;
  url?: string;
  description?: string;
};

export type PresetManifest = {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  fields: PresetField[];
  derived?: PresetDerived[];
  afterCreate?: PresetAfterCreateStep[];
};

export type PresetSummary = Pick<
  PresetManifest,
  "id" | "name" | "description" | "tags"
>;

export type CreateFromPresetInput = {
  name: string;
  presetId: string;
  fieldValues: Record<string, string>;
  defaultAgentProfileId?: string;
  defaultAgentCommand?: string;
  initialPrompt?: string;
  additionalFileWrites?: Record<string, string>;
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
  agentSettings: AgentSettings;
  playStateByProject: Record<string, PlayState>;
  playErrorByProject: Record<string, string | null>;
  runtimeProcessHealthyByProject: Record<string, boolean>;
  archivedProjects: string[];
  showArchived: boolean;
  sharedAssets: SharedAssetSnapshot[];
  sharedAssetsLoading: boolean;
  sharedAssetsError: string | null;
  sharedAssetsUploading: boolean;
  sharedEnv: Record<string, string>;
  sharedEnvLoading: boolean;
  sharedEnvError: string | null;
};

export const RESERVED_PROJECT_NAMES = new Set(["logs", "shared-assets"]);
export const MAX_RUNTIME_TELEMETRY_EVENTS = 200;
export const PLAY_START_TIMEOUT_MS = 20000;
export const PORTLESS_APP_PORT_MIN = 43000;
export const PORTLESS_APP_PORT_MAX = 49999;
export const TERMINAL_SESSIONS_STORAGE_KEY = "weekend.terminal-sessions-by-project.v1";
export const PROJECT_ORDER_STORAGE_KEY = "weekend.project-order.v1";
export const AGENT_SETTINGS_STORAGE_KEY = "weekend.agent-settings.v1";

export function isUserProjectName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return !RESERVED_PROJECT_NAMES.has(trimmed.toLowerCase());
}

export type ControllerContext = {
  getState: () => WorkspaceControllerState;
  setState: (updater: (prev: WorkspaceControllerState) => WorkspaceControllerState) => void;
};

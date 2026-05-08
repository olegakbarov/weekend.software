import type {
  AgentProfile,
  AgentSettings,
  AgentSessionIdStrategy,
  ProcessEntrySnapshot,
} from "./types";

export const DEFAULT_AGENT_PROFILES: AgentProfile[] = [
  {
    id: "claude",
    label: "Claude Code",
    provider: "claude-code",
    command: "claude",
    sessionIdStrategy: "preseed-uuid",
    resumeCommand: "claude --resume {{sessionId}}",
  },
  {
    id: "claude-skip-permissions",
    label: "Claude Code (skip permissions)",
    provider: "claude-code",
    command: "claude --dangerously-skip-permissions",
    sessionIdStrategy: "preseed-uuid",
    resumeCommand: "claude --resume {{sessionId}}",
  },
  {
    id: "codex",
    label: "Codex",
    provider: "codex",
    command: "codex",
    sessionIdStrategy: "hook-json",
    resumeCommand: "codex resume {{sessionId}}",
  },
];

export const DEFAULT_AGENT_PROFILE_ID = DEFAULT_AGENT_PROFILES[0]!.id;

const RESERVED_PROFILE_IDS = new Set(DEFAULT_AGENT_PROFILES.map((profile) => profile.id));

export function slugifyAgentProfileId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function normalizeAgentSettings(input: unknown): AgentSettings {
  const fallback: AgentSettings = {
    profiles: DEFAULT_AGENT_PROFILES,
    defaultProfileId: DEFAULT_AGENT_PROFILE_ID,
  };

  if (!input || typeof input !== "object") {
    return fallback;
  }

  const candidate = input as Partial<AgentSettings>;
  const customProfiles = Array.isArray(candidate.profiles)
    ? candidate.profiles
        .filter((profile): profile is AgentProfile => {
          if (!profile || typeof profile !== "object") return false;
          return (
            typeof profile.id === "string" &&
            typeof profile.label === "string" &&
            typeof profile.command === "string" &&
            typeof profile.provider === "string" &&
            typeof profile.sessionIdStrategy === "string"
          );
        })
        .map((profile) => normalizeAgentProfile(profile))
        .filter((profile): profile is AgentProfile => profile !== null)
    : [];

  const byId = new Map<string, AgentProfile>();
  for (const profile of DEFAULT_AGENT_PROFILES) {
    byId.set(profile.id, profile);
  }
  for (const profile of customProfiles) {
    byId.set(profile.id, profile);
  }

  const profiles = Array.from(byId.values());
  const requestedDefault =
    typeof candidate.defaultProfileId === "string"
      ? candidate.defaultProfileId.trim()
      : "";
  const defaultProfileId = byId.has(requestedDefault)
    ? requestedDefault
    : profiles[0]?.id ?? DEFAULT_AGENT_PROFILE_ID;

  return { profiles, defaultProfileId };
}

export function normalizeAgentProfile(profile: AgentProfile): AgentProfile | null {
  const id = slugifyAgentProfileId(profile.id || profile.label || profile.command);
  const label = profile.label.trim();
  const command = profile.command.trim();
  if (!id || !label || !command) return null;

  return {
    id,
    label,
    command,
    provider:
      profile.provider === "claude-code" ||
      profile.provider === "codex" ||
      profile.provider === "custom"
        ? profile.provider
        : "custom",
    sessionIdStrategy: normalizeSessionIdStrategy(profile.sessionIdStrategy),
    resumeCommand:
      typeof profile.resumeCommand === "string" && profile.resumeCommand.trim()
        ? profile.resumeCommand.trim()
        : null,
  };
}

function normalizeSessionIdStrategy(
  strategy: string | AgentSessionIdStrategy
): AgentSessionIdStrategy {
  if (
    strategy === "preseed-uuid" ||
    strategy === "hook-json" ||
    strategy === "stdout-json" ||
    strategy === "stdout-regex" ||
    strategy === "filesystem" ||
    strategy === "none"
  ) {
    return strategy;
  }
  return "none";
}

export function isBuiltInAgentProfile(profileId: string): boolean {
  return RESERVED_PROFILE_IDS.has(profileId);
}

export function findAgentProfile(
  settings: AgentSettings,
  profileId: string | null | undefined
): AgentProfile | null {
  if (!profileId) return null;
  return settings.profiles.find((profile) => profile.id === profileId) ?? null;
}

export function defaultAgentProfile(settings: AgentSettings): AgentProfile {
  return (
    findAgentProfile(settings, settings.defaultProfileId) ??
    settings.profiles[0] ??
    DEFAULT_AGENT_PROFILES[0]!
  );
}

export function resolveProfileForProcess(
  settings: AgentSettings,
  entry: ProcessEntrySnapshot,
  preferredProfileId?: string | null
): AgentProfile {
  const preferred = findAgentProfile(settings, preferredProfileId);
  if (preferred) return preferred;

  const command = entry.command.trim();
  const exact = settings.profiles.find((profile) => profile.command.trim() === command);
  if (exact) return exact;

  const executable = command.split(/\s+/)[0] ?? "";
  const executableMatch = settings.profiles.find(
    (profile) => profile.command.trim().split(/\s+/)[0] === executable
  );
  return executableMatch ?? defaultAgentProfile(settings);
}

export function createAgentInstanceId(project: string, profileId: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 12);
  return `${slugifyAgentProfileId(project)}-${slugifyAgentProfileId(profileId)}-${random}`;
}

export function createAgentSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 12);
}

export function applyAgentLaunchStrategy(
  command: string,
  profile: AgentProfile,
  sessionId: string | null
): string {
  if (profile.sessionIdStrategy !== "preseed-uuid" || !sessionId) {
    return command;
  }

  if (profile.provider !== "claude-code") {
    return command;
  }

  if (/\s--session-id(?:\s|=|$)/.test(command) || /\s(?:-r|--resume)(?:\s|=|$)/.test(command)) {
    return command;
  }

  return `${command} --session-id ${shellQuote(sessionId)}`;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

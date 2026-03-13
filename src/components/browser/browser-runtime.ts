import type { PlayState, ProjectConfigReadSnapshot } from "@/lib/controller";
import { DEFAULT_PORTLESS_PROXY_PORT, isLocalDevHostname } from "./browser-url-utils";

export type BrowserRuntimeTarget = {
  status: "ready" | "loading" | "blocked";
  message: string;
  url: string | null;
  action: "play" | null;
};

export function buildRuntimeBrowserUrl(
  configSnapshot: ProjectConfigReadSnapshot
): string | null {
  if (!configSnapshot.configValid) {
    return null;
  }

  const runtimeUrl = configSnapshot.runtimeUrl?.trim() ?? "";
  if (runtimeUrl) {
    try {
      const hasScheme =
        runtimeUrl.startsWith("http://") || runtimeUrl.startsWith("https://");
      const parsed = new URL(hasScheme ? runtimeUrl : `http://${runtimeUrl}`);
      if (parsed.hostname === "0.0.0.0") {
        parsed.hostname = "localhost";
      }
      if (
        isLocalDevHostname(parsed.hostname) &&
        parsed.port.length === 0
      ) {
        parsed.port = String(DEFAULT_PORTLESS_PROXY_PORT);
      }
      return parsed.toString();
    } catch {
      return null;
    }
  }
  return null;
}

function buildProjectConfigInvalidReason(
  configSnapshot: ProjectConfigReadSnapshot
): string {
  const explicitError = configSnapshot.error?.trim();
  if (explicitError) {
    return explicitError;
  }

  return "runtime.url must be a valid local address.";
}

export function resolveBrowserRuntimeTarget({
  projectId,
  playState,
  hasHealthyRuntimeProcess,
  isProjectConfigLoading,
  projectConfigError,
  projectConfigSnapshot,
}: {
  projectId: string | null;
  playState: PlayState;
  hasHealthyRuntimeProcess: boolean;
  isProjectConfigLoading: boolean;
  projectConfigError: string | null;
  projectConfigSnapshot: ProjectConfigReadSnapshot | null;
}): BrowserRuntimeTarget {
  if (!projectId) {
    return {
      status: "blocked",
      message: "Select a project to open the runtime browser.",
      url: null,
      action: null,
    };
  }

  if (projectConfigError) {
    const configPath = projectConfigSnapshot?.configPath;
    return {
      status: "blocked",
      message: configPath
        ? `Failed to read runtime config at ${configPath}: ${projectConfigError}`
        : `Failed to read runtime config for ${projectId}: ${projectConfigError}`,
      url: null,
      action: null,
    };
  }

  if (!projectConfigSnapshot) {
    return {
      status: isProjectConfigLoading ? "loading" : "blocked",
      message: isProjectConfigLoading
        ? `Reading runtime config for ${projectId}...`
        : `Runtime config is not ready for ${projectId}.`,
      url: null,
      action: isProjectConfigLoading ? null : "play",
    };
  }

  if (projectConfigSnapshot.source !== "project-config") {
    if (!projectConfigSnapshot.configExists) {
      return {
        status: "blocked",
        message: `Browser is blocked. Runtime config is missing: ${projectConfigSnapshot.configPath}`,
        url: null,
        action: null,
      };
    }
    const reason = buildProjectConfigInvalidReason(projectConfigSnapshot);
    return {
      status: "blocked",
      message: `Browser is blocked. Runtime config is invalid at ${projectConfigSnapshot.configPath}: ${reason}`,
      url: null,
      action: null,
    };
  }

  if (!projectConfigSnapshot.configExists) {
    return {
      status: "blocked",
      message: `Browser is blocked. Runtime config is missing: ${projectConfigSnapshot.configPath}`,
      url: null,
      action: null,
    };
  }

  if (!projectConfigSnapshot.configValid) {
    const reason = buildProjectConfigInvalidReason(projectConfigSnapshot);
    return {
      status: "blocked",
      message: `Browser is blocked. Runtime config is invalid at ${projectConfigSnapshot.configPath}: ${reason}`,
      url: null,
      action: null,
    };
  }

  const runtimeUrl = buildRuntimeBrowserUrl(projectConfigSnapshot);
  if (!runtimeUrl) {
    return {
      status: "blocked",
      message: `Browser is blocked. runtime.url in ${projectConfigSnapshot.configPath} is missing or not a valid local address.`,
      url: null,
      action: null,
    };
  }

  if (playState === "starting") {
    return {
      status: "loading",
      message: hasHealthyRuntimeProcess
        ? `Loading ${runtimeUrl}...`
        : `Starting runtime for ${projectId}...`,
      url: runtimeUrl,
      action: null,
    };
  }

  if (!hasHealthyRuntimeProcess) {
    return {
      status: "blocked",
      message: "Runtime is not running for this project.",
      url: null,
      action: "play",
    };
  }

  return {
    status: "ready",
    message: runtimeUrl,
    url: runtimeUrl,
    action: null,
  };
}

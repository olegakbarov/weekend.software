import { invoke } from "@tauri-apps/api/core";
import {
  type PortlessLaunchPlan,
  PORTLESS_APP_PORT_MIN,
  PORTLESS_APP_PORT_MAX,
} from "./types";

export function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function normalizePortlessProjectName(project: string): string {
  const trimmed = project.trim().toLowerCase();
  if (!trimmed) return "app";
  const normalized = trimmed.replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
  const collapsed = normalized.replace(/^\.+|\.+$/g, "").replace(/^-+|-+$/g, "");
  return collapsed.length > 0 ? collapsed : "app";
}

export function isAlreadyPortlessWrapped(command: string): boolean {
  const lowered = command.toLowerCase();
  return (
    lowered.includes("portless ") ||
    lowered.includes(" portless") ||
    lowered.includes("weekend_portless_cli")
  );
}

export function tokenizeSimpleCommandForPortless(command: string): string[] | null {
  const input = command.trim();
  if (!input) return null;

  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaping = false;

  const flush = () => {
    if (!current) return;
    tokens.push(current);
    current = "";
  };

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;

    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      if (quote === "'") {
        current += char;
      } else {
        escaping = true;
      }
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      flush();
      continue;
    }

    if (
      char === "|" ||
      char === "&" ||
      char === ";" ||
      char === "<" ||
      char === ">" ||
      char === "(" ||
      char === ")" ||
      char === "`" ||
      char === "$"
    ) {
      return null;
    }

    current += char;
  }

  if (escaping || quote) return null;
  flush();
  return tokens.length > 0 ? tokens : null;
}

export function parseExplicitPortFromCommand(command: string): number | null {
  const explicitLong = command.match(
    /(?:^|\s)--port(?:\s+|=)(\d{2,5})(?:\s|$)/
  );
  const explicitShort = command.match(/(?:^|\s)-p(?:\s+|=)(\d{2,5})(?:\s|$)/);
  const candidate = explicitLong?.[1] ?? explicitShort?.[1];
  if (!candidate) return null;
  const parsed = Number.parseInt(candidate, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    return null;
  }
  return parsed;
}

export function deriveDeterministicPortlessAppPort(project: string): number {
  let hash = 5381;
  for (let index = 0; index < project.length; index += 1) {
    hash = ((hash << 5) + hash + project.charCodeAt(index)) >>> 0;
  }
  return PORTLESS_APP_PORT_MIN + (hash % (PORTLESS_APP_PORT_MAX - PORTLESS_APP_PORT_MIN + 1));
}

export async function resolveAvailablePortlessAppPort(
  project: string,
  preferred: number
): Promise<number> {
  const preferredInRange =
    preferred >= PORTLESS_APP_PORT_MIN && preferred <= PORTLESS_APP_PORT_MAX;
  const fallback = preferredInRange
    ? preferred
    : deriveDeterministicPortlessAppPort(project);
  try {
    const resolved = await invoke<number>("find_available_port", {
      preferred: fallback,
      min: PORTLESS_APP_PORT_MIN,
      max: PORTLESS_APP_PORT_MAX,
    });
    if (
      Number.isFinite(resolved) &&
      resolved >= PORTLESS_APP_PORT_MIN &&
      resolved <= PORTLESS_APP_PORT_MAX
    ) {
      return resolved;
    }
  } catch {
    // Fallback to deterministic port if backend probing fails.
  }
  return fallback;
}

export function isPackageManagerDevCommand(tokens: string[]): boolean {
  if (tokens.length < 2) return false;
  if (tokens[0] === "pnpm" && tokens[1] === "dev") return true;
  if (tokens[0] === "yarn" && tokens[1] === "dev") return true;
  if (tokens[0] === "npm" && tokens[1] === "run" && tokens[2] === "dev") {
    return true;
  }
  if (
    tokens[0] === "bun" &&
    ((tokens[1] === "run" && tokens[2] === "dev") || tokens[1] === "dev")
  ) {
    return true;
  }
  return false;
}

export function isViteDevScript(script: string): boolean {
  return /\bvite\b/i.test(script);
}

export function buildVitePortArgs(appPort: number): string {
  return `--host 127.0.0.1 --port ${appPort} --strictPort`;
}

export function augmentPackageManagerCommandForVite(
  command: string,
  tokens: string[],
  appPort: number
): string {
  const viteArgs = buildVitePortArgs(appPort);
  if (tokens.length === 2 && tokens[0] === "pnpm" && tokens[1] === "dev") {
    return `pnpm dev ${viteArgs}`;
  }
  if (
    tokens.length === 3 &&
    tokens[0] === "npm" &&
    tokens[1] === "run" &&
    tokens[2] === "dev"
  ) {
    return `npm run dev -- ${viteArgs}`;
  }
  if (tokens.length === 2 && tokens[0] === "yarn" && tokens[1] === "dev") {
    return `yarn dev ${viteArgs}`;
  }
  if (
    tokens.length === 3 &&
    tokens[0] === "bun" &&
    tokens[1] === "run" &&
    tokens[2] === "dev"
  ) {
    return `bun run dev ${viteArgs}`;
  }
  if (tokens.length === 2 && tokens[0] === "bun" && tokens[1] === "dev") {
    return `bun dev ${viteArgs}`;
  }
  return command;
}

export async function resolvePortlessLaunchPlan(
  project: string,
  command: string
): Promise<PortlessLaunchPlan> {
  const explicitInCommand = parseExplicitPortFromCommand(command);
  if (explicitInCommand !== null) {
    return { command, appPort: explicitInCommand };
  }

  const tokens = tokenizeSimpleCommandForPortless(command);
  if (!tokens || !isPackageManagerDevCommand(tokens)) {
    return { command, appPort: null };
  }

  try {
    const rawPackageJson = await invoke<string>("read_project_file", {
      project,
      path: "package.json",
    });
    const parsed = JSON.parse(rawPackageJson) as {
      scripts?: Record<string, unknown>;
    };
    const devScript =
      parsed &&
      parsed.scripts &&
      typeof parsed.scripts.dev === "string"
        ? parsed.scripts.dev
        : null;
    if (!devScript) {
      return { command, appPort: null };
    }
    const explicitInScript = parseExplicitPortFromCommand(devScript);
    if (!isViteDevScript(devScript)) {
      if (explicitInScript !== null) {
        return { command, appPort: explicitInScript };
      }
      return { command, appPort: null };
    }

    const preferredPort =
      explicitInScript ?? deriveDeterministicPortlessAppPort(project);
    const appPort = await resolveAvailablePortlessAppPort(
      project,
      preferredPort
    );
    return {
      command: augmentPackageManagerCommandForVite(command, tokens, appPort),
      appPort,
    };
  } catch {
    return { command, appPort: null };
  }
}

export function buildPortlessCommand(
  command: string,
  project: string,
  appPort: number | null = null
): string {
  const projectName = normalizePortlessProjectName(project);
  const projectArg = shellSingleQuote(projectName);
  const parsedArgs = tokenizeSimpleCommandForPortless(command);
  const hasLeadingEnvAssignment = Boolean(
    parsedArgs?.[0] && /^[A-Za-z_][A-Za-z0-9_]*=.*/.test(parsedArgs[0])
  );
  const directCommandArgs =
    parsedArgs && !hasLeadingEnvAssignment ? parsedArgs : null;
  const directCommand = directCommandArgs
    ? directCommandArgs.map(shellSingleQuote).join(" ")
    : null;
  const wrappedCommand = shellSingleQuote(command);
  const appPortArg =
    typeof appPort === "number" && appPort >= 1 && appPort <= 65535
      ? ` --app-port ${appPort}`
      : "";

  return [
    'PORTLESS_CLI="${WEEKEND_PORTLESS_CLI:-}";',
    'PORTLESS_BIN="${WEEKEND_PORTLESS_BIN:-portless}";',
    'if [ -n "$PORTLESS_CLI" ]; then',
    directCommand
      ? `  "$PORTLESS_CLI" --name ${projectArg} --force${appPortArg} -- ${directCommand};`
      : `  "$PORTLESS_CLI" --name ${projectArg} --force${appPortArg} -- /bin/sh -lc ${wrappedCommand};`,
    "else",
    directCommand
      ? `  "$PORTLESS_BIN" --name ${projectArg} --force${appPortArg} -- ${directCommand};`
      : `  "$PORTLESS_BIN" --name ${projectArg} --force${appPortArg} -- /bin/sh -lc ${wrappedCommand};`,
    "fi",
  ].join(" ");
}

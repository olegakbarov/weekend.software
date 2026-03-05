import {
  safeLocalStorageGetItem,
  safeLocalStorageSetItem,
} from "@/lib/utils/safe-local-storage";
import {
  type TerminalSessionDescriptor,
  type ProcessRole,
  TERMINAL_SESSIONS_STORAGE_KEY,
  PROJECT_ORDER_STORAGE_KEY,
} from "./types";

export function loadTerminalSessionsFromStorage(): Record<
  string,
  TerminalSessionDescriptor[]
> {
  const serialized = safeLocalStorageGetItem(TERMINAL_SESSIONS_STORAGE_KEY);
  if (!serialized) return {};

  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!parsed || typeof parsed !== "object") return {};

    const result: Record<string, TerminalSessionDescriptor[]> = {};
    for (const [project, value] of Object.entries(
      parsed as Record<string, unknown>
    )) {
      const projectName = project.trim();
      if (!projectName) continue;
      if (!Array.isArray(value)) continue;
      const descriptors: TerminalSessionDescriptor[] = [];
      const seenTerminalIds = new Set<string>();
      const seenLabels = new Set<string>();
      for (const item of value) {
        if (!item || typeof item !== "object") continue;
        const candidate = item as TerminalSessionDescriptor;
        if (
          typeof candidate.terminalId !== "string" ||
          typeof candidate.project !== "string" ||
          typeof candidate.label !== "string" ||
          typeof candidate.createdAt !== "number"
        ) {
          continue;
        }

        const terminalId = candidate.terminalId.trim();
        const label = candidate.label.trim();
        if (!terminalId || seenTerminalIds.has(terminalId)) {
          continue;
        }
        if (!label || seenLabels.has(label)) continue;

        seenTerminalIds.add(terminalId);
        seenLabels.add(label);
        descriptors.push({
          ...candidate,
          terminalId,
          project: projectName,
          displayName: typeof candidate.displayName === "string" ? candidate.displayName : label,
          customName: typeof candidate.customName === "string" ? candidate.customName : null,
          status: candidate.status === "alive" || candidate.status === "exited" ? candidate.status : "alive",
          hasActiveProcess: candidate.hasActiveProcess === true,
          foregroundProcessName:
            typeof candidate.foregroundProcessName === "string"
              ? candidate.foregroundProcessName
              : null,
          label,
          playSpawned: typeof candidate.playSpawned === "boolean" ? candidate.playSpawned : false,
          processRole: typeof candidate.processRole === "string" ? candidate.processRole as ProcessRole : null,
        });
      }
      if (descriptors.length > 0) {
        result[projectName] = descriptors;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function persistTerminalSessions(
  sessionsByProject: Record<string, TerminalSessionDescriptor[]>
): void {
  safeLocalStorageSetItem(
    TERMINAL_SESSIONS_STORAGE_KEY,
    JSON.stringify(sessionsByProject)
  );
}

export function loadProjectOrderFromStorage(): string[] {
  const serialized = safeLocalStorageGetItem(PROJECT_ORDER_STORAGE_KEY);
  if (!serialized) return [];
  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  } catch {
    return [];
  }
}

export function persistProjectOrder(order: string[]): void {
  safeLocalStorageSetItem(PROJECT_ORDER_STORAGE_KEY, JSON.stringify(order));
}

export function reconcileProjectOrder(
  savedOrder: string[],
  backendProjects: string[]
): string[] {
  const backendSet = new Set(backendProjects);
  const kept = savedOrder.filter((name) => backendSet.has(name));
  const keptSet = new Set(kept);
  const added = backendProjects.filter((name) => !keptSet.has(name));
  return [...kept, ...added];
}

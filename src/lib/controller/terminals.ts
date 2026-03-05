import { invoke } from "@tauri-apps/api/core";
import { terminalRegistry } from "@/lib/terminal-registry";
import {
  type ControllerContext,
  type ProcessRole,
  type TerminalSessionDescriptor,
  makeTerminalId,
} from "./types";
import { persistTerminalSessions } from "./persistence";
import { reconcileProjectRuntimeState } from "./runtime";
import type { RuntimeInternals } from "./runtime";

export function generateUniqueTerminalName(
  existing: TerminalSessionDescriptor[],
  project: string,
  baseLabel: string
): { label: string; terminalId: string } {
  const usedLabels = new Set(existing.map((d) => d.label));
  const usedTerminalIds = new Set(existing.map((d) => d.terminalId));
  let label = baseLabel;
  let terminalId = makeTerminalId(project, label);
  if (!usedLabels.has(label) && !usedTerminalIds.has(terminalId)) {
    return { label, terminalId };
  }

  let counter = 2;
  while (true) {
    label = `${baseLabel} ${counter}`;
    terminalId = makeTerminalId(project, label);
    if (!usedLabels.has(label) && !usedTerminalIds.has(terminalId)) {
      return { label, terminalId };
    }
    counter++;
  }
}

export function createTerminalSession(
  ctx: ControllerContext,
  project: string,
  label?: string,
  opts?: { playSpawned?: boolean; processRole?: ProcessRole }
): TerminalSessionDescriptor {
  const projectName = project.trim();
  const existing = ctx.getState().terminalSessionsByProject[projectName] ?? [];
  const defaultLabel = "Shell";
  const resolved = generateUniqueTerminalName(
    existing,
    projectName,
    label?.trim() || defaultLabel
  );

  const descriptor: TerminalSessionDescriptor = {
    terminalId: resolved.terminalId,
    project: projectName,
    displayName: resolved.label,
    customName: null,
    status: "alive" as const,
    hasActiveProcess: false,
    foregroundProcessName: null,
    label: resolved.label,
    createdAt: Date.now(),
    playSpawned: opts?.playSpawned ?? false,
    processRole: opts?.processRole ?? null,
  };

  ctx.setState((previous) => {
    const updated = {
      ...previous,
      terminalSessionsByProject: {
        ...previous.terminalSessionsByProject,
        [projectName]: [
          ...(previous.terminalSessionsByProject[projectName] ?? []),
          descriptor,
        ],
      },
    };
    persistTerminalSessions(updated.terminalSessionsByProject);
    return updated;
  });

  return descriptor;
}

export function removeTerminalSession(
  ctx: ControllerContext,
  internals: RuntimeInternals,
  terminalId: string
): void {
  terminalRegistry.destroy(terminalId);
  const affectedProjects: string[] = [];
  ctx.setState((previous) => {
    const nextSessionsByProject = { ...previous.terminalSessionsByProject };
    for (const [project, sessions] of Object.entries(nextSessionsByProject)) {
      const filtered = sessions.filter((session) => session.terminalId !== terminalId);
      if (filtered.length === sessions.length) continue;
      affectedProjects.push(project);
      if (filtered.length === 0) {
        delete nextSessionsByProject[project];
      } else {
        nextSessionsByProject[project] = filtered;
      }
    }
    const next = {
      ...previous,
      terminalSessionsByProject: nextSessionsByProject,
    };
    persistTerminalSessions(next.terminalSessionsByProject);
    return next;
  });
  for (const project of affectedProjects) {
    reconcileProjectRuntimeState(ctx, internals, project);
  }
  void invoke("terminal_remove_session", { terminalId }).catch(() => undefined);
}

export function renameTerminalSession(
  // ctx reserved for future optimistic update
  _ctx: ControllerContext,
  terminalId: string,
  newLabel: string
): void {
  const trimmedLabel = newLabel.trim();
  if (!trimmedLabel) return;
  void invoke("terminal_set_custom_name", {
    terminalId,
    name: trimmedLabel,
  }).catch(() => undefined);
}

export function getAgentTerminalId(
  ctx: ControllerContext,
  project: string
): string | null {
  const sessions = ctx.getState().terminalSessionsByProject[project] ?? [];
  const preferred =
    sessions.find((s) => s.processRole === "agent" && s.status === "alive") ??
    sessions.find((s) => s.processRole === "agent");
  return preferred?.terminalId ?? null;
}

export function ensureAgentTerminalSession(
  ctx: ControllerContext,
  project: string
): string {
  const projectName = project.trim();
  if (!projectName) {
    return createTerminalSession(ctx, project).terminalId;
  }

  const existing = getAgentTerminalId(ctx, projectName);
  if (existing) return existing;

  const descriptor = createTerminalSession(ctx, projectName, "agent", {
    processRole: "agent",
  });
  void terminalRegistry
    .acquire(descriptor.terminalId, projectName, { processRole: "agent" })
    .catch(() => undefined);
  return descriptor.terminalId;
}

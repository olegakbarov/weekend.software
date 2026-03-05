import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  type ControllerContext,
  type ProcessRole,
  type ProjectTreeChangedPayload,
  type TerminalSessionDescriptor,
  isUserProjectName,
} from "./types";
import { persistTerminalSessions } from "./persistence";
import { reconcileProjectRuntimeState } from "./runtime";
import type { RuntimeInternals } from "./runtime";
import { refreshProjectTree, refreshProjectConfig } from "./projects";
import type { ProjectInternals } from "./projects";

export async function setupListeners(
  ctx: ControllerContext,
  projectInternals: ProjectInternals,
  runtimeInternals: RuntimeInternals,
  unlistenFns: { current: UnlistenFn[] }
): Promise<void> {
  if (unlistenFns.current.length > 0) return;

  const unlistenProjectTreeChanged = await listen<ProjectTreeChangedPayload>(
    "project-tree-changed",
    (event) => {
      const project = event.payload.project.trim();
      if (!isUserProjectName(project)) return;

      ctx.setState((previous) => ({
        ...previous,
        filesystemEventVersion: previous.filesystemEventVersion + 1,
        filesystemEventVersionByProject: {
          ...previous.filesystemEventVersionByProject,
          [project]: (previous.filesystemEventVersionByProject[project] ?? 0) + 1,
        },
      }));

      void refreshProjectTree(ctx, projectInternals, project).catch(() => undefined);
      void refreshProjectConfig(ctx, projectInternals, runtimeInternals, project).catch(() => undefined);
    }
  );

  type SessionChangedPayload = {
    terminalId: string;
    project: string;
    displayName: string;
    customName: string | null;
    status: "alive" | "exited";
    hasActiveProcess: boolean;
    foregroundProcessName: string | null;
    createdAt: number;
    playSpawned: boolean;
    processRole: ProcessRole | null;
  };

  const unlistenSessionChanged = await listen<SessionChangedPayload>(
    "terminal-session-changed",
    (event) => {
      const p = event.payload;
      const project = p.project.trim();
      if (!project) return;

      ctx.setState((previous) => {
        const existing = previous.terminalSessionsByProject[project] ?? [];
        const index = existing.findIndex((s) => s.terminalId === p.terminalId);
        const descriptor: TerminalSessionDescriptor = {
          terminalId: p.terminalId,
          project,
          displayName: p.displayName,
          customName: p.customName,
          status: p.status,
          hasActiveProcess: p.hasActiveProcess === true,
          foregroundProcessName:
            typeof p.foregroundProcessName === "string"
              ? p.foregroundProcessName
              : null,
          label: p.customName ?? p.displayName,
          createdAt: p.createdAt,
          playSpawned: p.playSpawned ?? false,
          processRole: p.processRole ?? null,
        };

        const updated =
          index >= 0
            ? existing.map((s, i) => (i === index ? descriptor : s))
            : [...existing, descriptor];

        const next = {
          ...previous,
          terminalSessionsByProject: {
            ...previous.terminalSessionsByProject,
            [project]: updated,
          },
        };
        persistTerminalSessions(next.terminalSessionsByProject);
        return next;
      });
      reconcileProjectRuntimeState(ctx, runtimeInternals, project);
    }
  );

  type SessionRemovedPayload = {
    terminalId: string;
  };

  const unlistenSessionRemoved = await listen<SessionRemovedPayload>(
    "terminal-session-removed",
    (event) => {
      const { terminalId } = event.payload;
      let affectedProject: string | null = null;

      ctx.setState((previous) => {
        const updated = { ...previous.terminalSessionsByProject };
        for (const [proj, sessions] of Object.entries(updated)) {
          const filtered = sessions.filter((s) => s.terminalId !== terminalId);
          if (filtered.length !== sessions.length) {
            affectedProject = proj;
            if (filtered.length === 0) {
              delete updated[proj];
            } else {
              updated[proj] = filtered;
            }
          }
        }
        const next = {
          ...previous,
          terminalSessionsByProject: updated,
        };
        persistTerminalSessions(next.terminalSessionsByProject);
        return next;
      });
      if (affectedProject) {
        reconcileProjectRuntimeState(ctx, runtimeInternals, affectedProject);
      }
    }
  );

  unlistenFns.current = [
    unlistenProjectTreeChanged,
    unlistenSessionChanged,
    unlistenSessionRemoved,
  ];
}

import { createContext, useContext, type ReactNode } from "react";
import type { TerminalSessionDescriptor, PlayState } from "@/lib/controller";

// ── Data context (changes when state changes) ──

export type SidebarData = {
  currentProject: string | null;
  currentRoute: string;
  activeTerminalId: string | null;
  projects: string[];
  terminalSessionsByProject: Record<string, TerminalSessionDescriptor[]>;
  playStateByProject: Record<string, PlayState>;
  playErrorByProject: Record<string, string | null>;
  isFullscreen: boolean;
  showArchived: boolean;
  archivedProjects: string[];
};

const SidebarDataContext = createContext<SidebarData | null>(null);

// ── Actions context (stable refs, rarely triggers re-renders) ──

export type SidebarActions = {
  onOpenHome: () => void;
  onSelectBrowser: (project: string) => void;
  onSelectTerminal: (project: string, terminalId: string) => void;
  onCreateTerminal: (project: string) => void;
  onRenameTerminal: (terminalId: string, newLabel: string) => void;
  onRenameProject: (oldName: string, newName: string) => Promise<void>;
  onRemoveTerminal: (terminalId: string) => void;
  onReorderProjects: (reordered: string[]) => void;
  onPlay: (project: string) => void;
  onStop: (project: string) => void;
  onOpenSettings: () => void;
  onOpenLogs: () => void;
  onToggleShowArchived: () => void;
  onUnarchiveProject: (project: string) => Promise<void>;
  onToggleSidebar?: () => void;
};

const SidebarActionsContext = createContext<SidebarActions | null>(null);

// ── Provider ──

export function SidebarProvider({
  data,
  actions,
  children,
}: {
  data: SidebarData;
  actions: SidebarActions;
  children: ReactNode;
}) {
  return (
    <SidebarDataContext.Provider value={data}>
      <SidebarActionsContext.Provider value={actions}>
        {children}
      </SidebarActionsContext.Provider>
    </SidebarDataContext.Provider>
  );
}

// ── Hooks ──

export function useSidebarData(): SidebarData {
  const ctx = useContext(SidebarDataContext);
  if (!ctx) throw new Error("useSidebarData must be used within SidebarProvider");
  return ctx;
}

export function useSidebarActions(): SidebarActions {
  const ctx = useContext(SidebarActionsContext);
  if (!ctx) throw new Error("useSidebarActions must be used within SidebarProvider");
  return ctx;
}

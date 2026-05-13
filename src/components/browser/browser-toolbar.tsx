import { useMemo } from "react";
import {
  Crosshair,
  FileCode2,
  Plus,
  RefreshCw,
  Settings,
  X,
} from "lucide-react";
import {
  type ProcessEntrySnapshot,
  type ProcessRole,
  type TerminalSessionDescriptor,
  terminalDisplayLabel,
} from "@/lib/controller";
import { formatBrowserAddressDisplay } from "./browser-url-utils";

type WorkspaceMode =
  | "browser"
  | "editor"
  | "agent"
  | "terminal"
  | "settings";

type TerminalGroup = "processes" | "agents";

type ConfiguredProcessMap = Record<string, ProcessEntrySnapshot>;

function normalizeProcessMatchValue(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function addSessionMatchValues(
  values: Set<string>,
  value: string | null | undefined
): void {
  const normalized = normalizeProcessMatchValue(value);
  if (!normalized) return;
  values.add(normalized);

  const withoutNumericSuffix = normalized.replace(/\s+\d+$/, "");
  if (withoutNumericSuffix) {
    values.add(withoutNumericSuffix);
  }
}

function commandExecutableName(command: string): string {
  const firstToken = command.trim().split(/\s+/)[0] ?? "";
  const segments = firstToken.split(/[\\/]/);
  return normalizeProcessMatchValue(segments.at(-1));
}

function configuredRoleForSession(
  session: TerminalSessionDescriptor,
  configuredProcesses: ConfiguredProcessMap
): ProcessRole | null {
  const entries = Object.entries(configuredProcesses);
  if (entries.length === 0) return null;

  const matchValues = new Set<string>();
  addSessionMatchValues(matchValues, session.label);
  addSessionMatchValues(matchValues, session.displayName);
  addSessionMatchValues(matchValues, session.customName);
  addSessionMatchValues(matchValues, terminalDisplayLabel(session));

  const terminalLabel = session.terminalId.includes(":")
    ? session.terminalId.slice(session.terminalId.indexOf(":") + 1)
    : session.terminalId;
  addSessionMatchValues(matchValues, terminalLabel);

  for (const [label, entry] of entries) {
    if (matchValues.has(normalizeProcessMatchValue(label))) {
      return entry.role;
    }

    const executableName = commandExecutableName(entry.command);
    if (executableName && matchValues.has(executableName)) {
      return entry.role;
    }
  }

  const foreground = normalizeProcessMatchValue(session.foregroundProcessName);
  if (!foreground) return null;

  for (const [, entry] of entries) {
    if (commandExecutableName(entry.command) === foreground) {
      return entry.role;
    }
  }

  return null;
}

function resolvedProcessRoleForSession(
  session: TerminalSessionDescriptor,
  configuredProcesses: ConfiguredProcessMap
): ProcessRole | null {
  return (
    configuredRoleForSession(session, configuredProcesses) ??
    session.processRole
  );
}

function terminalGroupForSession(
  session: TerminalSessionDescriptor,
  configuredProcesses: ConfiguredProcessMap
): TerminalGroup {
  return resolvedProcessRoleForSession(session, configuredProcesses) === "agent"
    ? "agents"
    : "processes";
}

function TerminalTabStrip({
  processSessions,
  agentSessions,
  activeTerminalId,
  isActiveMode,
  onSelect,
  onRemove,
  onCreateProcess,
  onCreateAgent,
  disabled,
}: {
  processSessions: TerminalSessionDescriptor[];
  agentSessions: TerminalSessionDescriptor[];
  activeTerminalId: string | null;
  isActiveMode: boolean;
  onSelect: (terminalId: string) => void;
  onRemove: (terminalId: string) => void;
  onCreateProcess: () => void;
  onCreateAgent: () => void;
  disabled: boolean;
}) {
  const renderTab = (session: TerminalSessionDescriptor) => {
    const active = session.terminalId === activeTerminalId && isActiveMode;
    const sessionLabel = terminalDisplayLabel(session);
    return (
      <div
        className={`group inline-flex h-8 min-w-0 max-w-[11rem] items-center border-r border-border/60 transition-colors ${
          active
            ? "bg-secondary/60 text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
        key={session.terminalId}
      >
        <button
          className="inline-flex h-full min-w-0 flex-1 items-center pr-2 pl-8 text-[11px] disabled:cursor-default disabled:opacity-45"
          disabled={disabled}
          onClick={() => onSelect(session.terminalId)}
          title={sessionLabel}
          type="button"
        >
          <span className="min-w-0 truncate leading-none">
            {sessionLabel.toUpperCase()}
          </span>
        </button>
        <button
          aria-label={`Close ${sessionLabel}`}
          className="mr-2 inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground/70 opacity-0 transition-opacity hover:bg-foreground/10 hover:text-foreground focus:opacity-100 group-hover:opacity-100 disabled:cursor-default"
          disabled={disabled}
          onClick={() => onRemove(session.terminalId)}
          title="Close"
          type="button"
        >
          <X className="size-2.5" />
        </button>
      </div>
    );
  };

  const createBtnClass =
    "inline-flex h-8 shrink-0 items-center gap-1 border-l border-border/60 px-2.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-45";

  const totalSessions = processSessions.length + agentSessions.length;

  return (
    <div className="flex min-w-0 items-center rounded-md border border-border/80 bg-background font-vcr">
      {totalSessions === 0 ? (
        <span className="flex h-8 shrink-0 items-center px-2.5 text-[11px] text-muted-foreground/60">
          None
        </span>
      ) : (
        <>
          {processSessions.map(renderTab)}
          {agentSessions.map(renderTab)}
        </>
      )}
      <div className="min-w-0 flex-1" />
      <button
        aria-label="New terminal"
        className={createBtnClass}
        disabled={disabled}
        onClick={onCreateProcess}
        title="New terminal"
        type="button"
      >
        <Plus className="size-3" />
        <span className="leading-none">TERMINAL</span>
      </button>
      <button
        aria-label="New agent"
        className={createBtnClass}
        disabled={disabled}
        onClick={onCreateAgent}
        title="New agent"
        type="button"
      >
        <Plus className="size-3" />
        <span className="leading-none">AGENT</span>
      </button>
    </div>
  );
}

export function BrowserToolbar({
  workspaceMode,
  onWorkspaceModeChange,
  projectId,
  urlInputDraft,
  hasBrowserUrl,
  onReloadCurrentPage,
  isGrabbing,
  onToggleElementGrab,
  terminalSessions,
  configuredProcesses,
  activeTerminalId,
  onSelectTerminal,
  onRemoveTerminal,
  onCreateTerminal,
  onCreateAgentTerminal,
  onOpenConfigFile: _onOpenConfigFile,
}: {
  workspaceMode: WorkspaceMode;
  onWorkspaceModeChange: (
    mode: "browser" | "editor" | "agent" | "settings"
  ) => void;
  projectId: string | null;
  urlInputDraft: string;
  hasBrowserUrl: boolean;
  onReloadCurrentPage: () => void;
  isGrabbing: boolean;
  onToggleElementGrab: () => void;
  terminalSessions: TerminalSessionDescriptor[];
  configuredProcesses: ConfiguredProcessMap;
  activeTerminalId: string | null;
  onSelectTerminal: (terminalId: string) => void;
  onRemoveTerminal: (terminalId: string) => void;
  onCreateTerminal: () => void;
  onCreateAgentTerminal: () => void;
  onOpenConfigFile: () => void;
}) {
  const isBrowserActive = workspaceMode === "browser";
  const isTerminalActive =
    workspaceMode === "terminal" || workspaceMode === "agent";

  const { processSessions, agentSessions } = useMemo(() => {
    return {
      processSessions: terminalSessions.filter(
        (session) =>
          terminalGroupForSession(session, configuredProcesses) === "processes"
      ),
      agentSessions: terminalSessions.filter(
        (session) =>
          terminalGroupForSession(session, configuredProcesses) === "agents"
      ),
    };
  }, [configuredProcesses, terminalSessions]);

  const handleBrowserBarClick = () => {
    if (!isBrowserActive) {
      onWorkspaceModeChange("browser");
    }
  };

  const displayAddress = useMemo(
    () => formatBrowserAddressDisplay(urlInputDraft) || "browser:/",
    [urlInputDraft]
  );

  const sideBtn =
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background text-muted-foreground transition-colors hover:text-foreground";
  const sideBtnActive =
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-secondary/60 text-foreground transition-colors";

  return (
    <div className="relative h-12 shrink-0 border-b border-border bg-background">
      <div className="flex h-full items-center gap-2 px-3">
        <div className="grid min-w-0 flex-1 grid-cols-[1fr_2fr] gap-3">
          <div
            className={`flex min-w-0 items-center rounded-md border border-border/80 bg-background transition-opacity ${
              !isBrowserActive
                ? "cursor-pointer opacity-50 hover:opacity-70"
                : ""
            }`}
            onClick={!isBrowserActive ? handleBrowserBarClick : undefined}
            role={!isBrowserActive ? "button" : undefined}
            tabIndex={!isBrowserActive ? 0 : undefined}
          >
            <button
              aria-label="Files"
              aria-pressed={workspaceMode === "editor"}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 border-border/60 border-r px-2.5 font-vcr text-[11px] transition-colors disabled:cursor-default disabled:opacity-45 ${
                workspaceMode === "editor"
                  ? "bg-secondary/60 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              disabled={!projectId}
              onClick={(event) => {
                event.stopPropagation();
                onWorkspaceModeChange("editor");
              }}
              title="Files"
              type="button"
            >
              <FileCode2 className="size-3.5" />
              <span className="leading-none">FILES</span>
            </button>
            <div
              className="flex min-w-0 flex-1 items-center"
            >
              <span
                className="flex h-8 min-w-0 flex-1 items-center truncate px-2 font-code text-xs text-foreground/80"
                title={urlInputDraft}
              >
                {displayAddress}
              </span>
              <div className="flex shrink-0 items-center gap-0.5 pr-1">
                <button
                  className="rounded p-1 text-muted-foreground/50 transition-colors hover:text-foreground disabled:text-muted-foreground/25"
                  disabled={!hasBrowserUrl}
                  onClick={onReloadCurrentPage}
                  title="Reload"
                  type="button"
                >
                  <RefreshCw className="size-3.5" />
                </button>
                <button
                  aria-label="Grab element"
                  aria-pressed={isGrabbing}
                  className={
                    isGrabbing
                      ? "rounded bg-blue-500/10 p-1 text-blue-500 transition-colors hover:text-blue-400"
                      : "rounded p-1 text-muted-foreground/50 transition-colors hover:text-foreground disabled:text-muted-foreground/25"
                  }
                  disabled={!isBrowserActive || !hasBrowserUrl}
                  onClick={onToggleElementGrab}
                  title={isGrabbing ? "Stop grabbing element" : "Grab element"}
                  type="button"
                >
                  <Crosshair className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          <TerminalTabStrip
            processSessions={processSessions}
            agentSessions={agentSessions}
            activeTerminalId={activeTerminalId}
            isActiveMode={isTerminalActive}
            onSelect={onSelectTerminal}
            onRemove={onRemoveTerminal}
            onCreateProcess={onCreateTerminal}
            onCreateAgent={onCreateAgentTerminal}
            disabled={!projectId}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            aria-label="Project settings"
            aria-pressed={workspaceMode === "settings"}
            className={workspaceMode === "settings" ? sideBtnActive : sideBtn}
            disabled={!projectId}
            onClick={() => onWorkspaceModeChange("settings")}
            title="Project settings"
            type="button"
          >
            <Settings className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

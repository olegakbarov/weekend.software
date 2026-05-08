import { useMemo, useRef } from "react";
import {
  Blocks,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  FileCode2,
  Plus,
  RefreshCw,
  Settings,
} from "lucide-react";
import type { FormEvent } from "react";
import {
  type ProcessEntrySnapshot,
  type ProcessRole,
  type TerminalSessionDescriptor,
  terminalDisplayLabel,
} from "@/lib/controller";

type WorkspaceMode =
  | "browser"
  | "editor"
  | "agent"
  | "terminal"
  | "settings"
  | "skills";

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

function TabStrip({
  kind,
  sessions,
  activeTerminalId,
  isActiveMode,
  configuredProcesses,
  onSelect,
  onCreate,
  disabled,
}: {
  kind: TerminalGroup;
  sessions: TerminalSessionDescriptor[];
  activeTerminalId: string | null;
  isActiveMode: boolean;
  configuredProcesses: ConfiguredProcessMap;
  onSelect: (terminalId: string) => void;
  onCreate: () => void;
  disabled: boolean;
}) {
  const activeSession =
    sessions.find((session) => session.terminalId === activeTerminalId) ?? null;
  const isActiveGroup =
    !!activeSession &&
    terminalGroupForSession(activeSession, configuredProcesses) === kind &&
    isActiveMode;

  return (
    <div
      className={`flex min-w-0 items-center rounded-md border border-border/80 bg-background ${
        isActiveGroup ? "ring-1 ring-foreground/10" : ""
      }`}
    >
      <div className="flex h-8 min-w-0 flex-1 items-center gap-1 overflow-hidden px-1">
        {sessions.length === 0 ? (
          <span className="min-w-0 truncate px-1 font-vcr text-[11px] text-muted-foreground/60">
            None
          </span>
        ) : (
          sessions.map((session) => {
            const active = session.terminalId === activeTerminalId && isActiveMode;
            const sessionLabel = terminalDisplayLabel(session);
            return (
              <button
                className={`group flex h-6 min-w-0 max-w-[8rem] items-center gap-1 rounded px-1.5 transition-colors ${
                  active
                    ? "bg-secondary/70 text-foreground"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`}
                disabled={disabled}
                key={session.terminalId}
                onClick={() => onSelect(session.terminalId)}
                title={sessionLabel}
                type="button"
              >
                <span className="min-w-0 truncate font-vcr text-[11px]">{sessionLabel}</span>
                <span
                  className={`size-1.5 shrink-0 rounded-full ${
                    session.status === "alive"
                      ? "bg-emerald-400"
                      : "bg-muted-foreground/30"
                  }`}
                />
              </button>
            );
          })
        )}
      </div>

      <button
        aria-label={`New ${kind === "agents" ? "agent" : "process"} terminal`}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center border-border/60 border-l text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-45"
        disabled={disabled}
        onClick={onCreate}
        title={`New ${kind === "agents" ? "agent" : "process"} terminal`}
        type="button"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

export function BrowserToolbar({
  workspaceMode,
  onWorkspaceModeChange,
  projectId,
  urlInputDraft,
  addressBarError,
  hasBrowserUrl,
  onAddressBarDraftChange,
  onNavigateFromAddressBar,
  onGoBack,
  onGoForward,
  onReloadCurrentPage,
  isGrabbing,
  onToggleElementGrab,
  terminalSessions,
  configuredProcesses,
  activeTerminalId,
  onSelectTerminal,
  onCreateTerminal,
  onCreateAgentTerminal,
  onOpenConfigFile: _onOpenConfigFile,
}: {
  workspaceMode: WorkspaceMode;
  onWorkspaceModeChange: (
    mode: "browser" | "editor" | "agent" | "settings" | "skills"
  ) => void;
  projectId: string | null;
  urlInputDraft: string;
  addressBarError: string | null;
  hasBrowserUrl: boolean;
  onAddressBarDraftChange: (value: string) => void;
  onNavigateFromAddressBar: (event: FormEvent<HTMLFormElement>) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onReloadCurrentPage: () => void;
  isGrabbing: boolean;
  onToggleElementGrab: () => void;
  terminalSessions: TerminalSessionDescriptor[];
  configuredProcesses: ConfiguredProcessMap;
  activeTerminalId: string | null;
  onSelectTerminal: (terminalId: string) => void;
  onCreateTerminal: () => void;
  onCreateAgentTerminal: () => void;
  onOpenConfigFile: () => void;
}) {
  const isBrowserActive = workspaceMode === "browser";
  const isTerminalActive =
    workspaceMode === "terminal" || workspaceMode === "agent";
  const inputRef = useRef<HTMLInputElement>(null);

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
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const sideBtn =
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background text-muted-foreground transition-colors hover:text-foreground";
  const sideBtnActive =
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-secondary/60 text-foreground transition-colors";

  return (
    <div className="relative h-12 shrink-0 border-b border-border bg-background">
      <div className="flex h-full items-center gap-2 px-3">
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
          <div
            className={`flex min-w-0 items-center rounded-md border bg-background transition-opacity ${
              addressBarError
                ? "border-destructive/70"
                : "border-border/80 focus-within:border-foreground/30"
            } ${
              !isBrowserActive
                ? "cursor-pointer opacity-50 hover:opacity-70"
                : ""
            }`}
            onClick={!isBrowserActive ? handleBrowserBarClick : undefined}
            role={!isBrowserActive ? "button" : undefined}
            tabIndex={!isBrowserActive ? 0 : undefined}
          >
            <form
              className="flex min-w-0 flex-1 items-center"
              onSubmit={onNavigateFromAddressBar}
            >
              <input
                ref={inputRef}
                aria-invalid={addressBarError ? true : undefined}
                className="h-8 min-w-0 flex-1 bg-transparent px-2 font-code text-xs text-foreground outline-none placeholder:text-muted-foreground/60"
                onChange={(event) =>
                  onAddressBarDraftChange(event.target.value)
                }
                onClick={!isBrowserActive ? handleBrowserBarClick : undefined}
                placeholder="Enter URL and press Enter"
                readOnly={!isBrowserActive}
                spellCheck={false}
                tabIndex={!isBrowserActive ? -1 : undefined}
                value={urlInputDraft}
              />
              <div className="flex shrink-0 items-center gap-0.5 pr-1">
                <button
                  className="rounded p-1 text-muted-foreground/50 transition-colors hover:text-foreground disabled:text-muted-foreground/25"
                  disabled={!hasBrowserUrl}
                  onClick={onGoBack}
                  title="Back"
                  type="button"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <button
                  className="rounded p-1 text-muted-foreground/50 transition-colors hover:text-foreground disabled:text-muted-foreground/25"
                  disabled={!hasBrowserUrl}
                  onClick={onGoForward}
                  title="Forward"
                  type="button"
                >
                  <ChevronRight className="size-3.5" />
                </button>
                <button
                  className="rounded p-1 text-muted-foreground/50 transition-colors hover:text-foreground disabled:text-muted-foreground/25"
                  disabled={!hasBrowserUrl}
                  onClick={onReloadCurrentPage}
                  title="Reload"
                  type="button"
                >
                  <RefreshCw className="size-3" />
                </button>
              </div>
            </form>
          </div>

          <TabStrip
            kind="processes"
            sessions={processSessions}
            activeTerminalId={activeTerminalId}
            isActiveMode={isTerminalActive}
            configuredProcesses={configuredProcesses}
            onSelect={onSelectTerminal}
            onCreate={onCreateTerminal}
            disabled={!projectId}
          />

          <TabStrip
            kind="agents"
            sessions={agentSessions}
            activeTerminalId={activeTerminalId}
            isActiveMode={isTerminalActive}
            configuredProcesses={configuredProcesses}
            onSelect={onSelectTerminal}
            onCreate={onCreateAgentTerminal}
            disabled={!projectId}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isBrowserActive ? (
            <button
              aria-label="Grab element"
              aria-pressed={isGrabbing}
              className={
                isGrabbing
                  ? "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-blue-500/60 bg-blue-500/10 text-blue-500 transition-colors hover:text-blue-400"
                  : `${sideBtn} disabled:text-muted-foreground/25`
              }
              disabled={!hasBrowserUrl}
              onClick={onToggleElementGrab}
              title={isGrabbing ? "Stop grabbing element" : "Grab element"}
              type="button"
            >
              <Crosshair className="size-3.5" />
            </button>
          ) : null}

          <button
            aria-label="Files"
            aria-pressed={workspaceMode === "editor"}
            className={workspaceMode === "editor" ? sideBtnActive : sideBtn}
            disabled={!projectId}
            onClick={() => onWorkspaceModeChange("editor")}
            title="Files"
            type="button"
          >
            <FileCode2 className="size-3.5" />
          </button>

          <button
            aria-label="Skills"
            aria-pressed={workspaceMode === "skills"}
            className={workspaceMode === "skills" ? sideBtnActive : sideBtn}
            disabled={!projectId}
            onClick={() => onWorkspaceModeChange("skills")}
            title="Skills"
            type="button"
          >
            <Blocks className="size-3.5" />
          </button>

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

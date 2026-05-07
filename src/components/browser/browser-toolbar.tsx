import { useEffect, useMemo, useRef, useState } from "react";
import {
  Blocks,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  FileCode2,
  Monitor,
  Play,
  RefreshCw,
  Settings,
  Square,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import {
  type ProcessRole,
  type PlayState,
  type TerminalSessionDescriptor,
  terminalDisplayLabel,
} from "@/lib/controller";

export type BrowserSource = "local" | "web";

type WorkspaceMode =
  | "browser"
  | "editor"
  | "agent"
  | "terminal"
  | "settings"
  | "skills";

type TerminalGroup = "processes" | "agents";

function terminalGroupForSession(
  session: TerminalSessionDescriptor
): TerminalGroup {
  return session.processRole === "agent" ? "agents" : "processes";
}

function processRoleLabel(role: ProcessRole | null): string {
  if (role === "dev-server") return "dev server";
  if (role === "service") return "service";
  if (role === "agent") return "agent";
  return "shell";
}

function sessionDetailLabel(session: TerminalSessionDescriptor): string {
  const foreground = session.foregroundProcessName?.trim();
  if (foreground) return foreground;
  if (session.status === "exited") return "exited";
  return processRoleLabel(session.processRole);
}

export function BrowserToolbar({
  workspaceMode,
  onWorkspaceModeChange,
  projectId,
  // Address bar
  urlInputDraft,
  addressBarError,
  hasBrowserUrl,
  onAddressBarDraftChange,
  onNavigateFromAddressBar,
  // Nav buttons
  onGoBack,
  onGoForward,
  onReloadCurrentPage,
  // Grab
  isGrabbing,
  onToggleElementGrab,
  // Terminal tabs
  terminalSessions,
  activeTerminalId,
  onSelectTerminal,
  onCreateTerminal,
  onCreateAgentTerminal,
  onRemoveTerminal,
  // Play
  playState,
  onPlay,
  onStop,
  hasHealthyRuntimeProcess,
  // Browser source
  browserSource,
  onBrowserSourceChange,
  onOpenConfigFile,
}: {
  workspaceMode: WorkspaceMode;
  onWorkspaceModeChange: (
    mode: "browser" | "editor" | "agent" | "settings" | "skills"
  ) => void;
  projectId: string | null;
  // Address bar
  urlInputDraft: string;
  addressBarError: string | null;
  hasBrowserUrl: boolean;
  onAddressBarDraftChange: (value: string) => void;
  onNavigateFromAddressBar: (event: FormEvent<HTMLFormElement>) => void;
  // Nav buttons
  onGoBack: () => void;
  onGoForward: () => void;
  onReloadCurrentPage: () => void;
  // Grab
  isGrabbing: boolean;
  onToggleElementGrab: () => void;
  // Terminal tabs
  terminalSessions: TerminalSessionDescriptor[];
  activeTerminalId: string | null;
  onSelectTerminal: (terminalId: string) => void;
  onCreateTerminal: () => void;
  onCreateAgentTerminal: () => void;
  onRemoveTerminal: (terminalId: string) => void;
  // Play
  playState: PlayState;
  onPlay: () => void;
  onStop: () => void;
  hasHealthyRuntimeProcess: boolean;
  // Browser source
  browserSource: BrowserSource;
  onBrowserSourceChange: (source: BrowserSource) => void;
  onOpenConfigFile: () => void;
}) {
  const isAppIdle = playState === "idle" || playState === "failed";
  const isAppRunning = playState === "running";
  const isAppStarting = playState === "starting";

  const isBrowserActive = workspaceMode === "browser";
  const isTerminalActive = workspaceMode === "terminal";
  const [openTerminalGroup, setOpenTerminalGroup] =
    useState<TerminalGroup | null>(null);
  const [pendingTerminalGroup, setPendingTerminalGroup] =
    useState<TerminalGroup | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const { processSessions, agentSessions, activeTerminalSession } =
    useMemo(() => {
      const active =
        terminalSessions.find(
          (session) => session.terminalId === activeTerminalId
        ) ?? null;
      return {
        processSessions: terminalSessions.filter(
          (session) => terminalGroupForSession(session) === "processes"
        ),
        agentSessions: terminalSessions.filter(
          (session) => terminalGroupForSession(session) === "agents"
        ),
        activeTerminalSession: active,
      };
    }, [activeTerminalId, terminalSessions]);

  const openTerminalSessions =
    openTerminalGroup === "agents" ? agentSessions : processSessions;
  const openTerminalGroupLabel =
    openTerminalGroup === "agents" ? "Agents" : "Processes";

  useEffect(() => {
    setOpenTerminalGroup(null);
    setPendingTerminalGroup(null);
  }, [projectId]);

  useEffect(() => {
    if (!openTerminalGroup) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenTerminalGroup(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openTerminalGroup]);

  useEffect(() => {
    if (!pendingTerminalGroup) return;
    if (workspaceMode !== "terminal" && workspaceMode !== "agent") return;
    setOpenTerminalGroup(pendingTerminalGroup);
    setPendingTerminalGroup(null);
  }, [pendingTerminalGroup, workspaceMode]);

  useEffect(() => {
    if (!openTerminalGroup) return;
    if (workspaceMode === "terminal" || workspaceMode === "agent") return;
    setOpenTerminalGroup(null);
  }, [openTerminalGroup, workspaceMode]);

  // Health indicator dot color
  const healthDotColor = isAppRunning
    ? hasHealthyRuntimeProcess
      ? "bg-emerald-400"
      : "bg-amber-400 animate-pulse"
    : isAppStarting
      ? "bg-amber-400 animate-pulse"
      : "";

  const handleBrowserBarClick = () => {
    if (!isBrowserActive) {
      onWorkspaceModeChange("browser");
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const segBtnBase =
    "inline-flex h-8 items-center justify-center transition-colors";
  const segBtnActive = `${segBtnBase} bg-secondary/60 text-foreground`;
  const segBtnInactive = `${segBtnBase} text-muted-foreground hover:text-foreground`;
  const groupBtnBase =
    "relative inline-flex h-8 shrink-0 items-center justify-center gap-1.5 px-2 font-vcr text-[11px] uppercase tracking-wide transition-colors disabled:cursor-default disabled:opacity-45";

  const terminalSessionsForGroup = (group: TerminalGroup) =>
    group === "agents" ? agentSessions : processSessions;

  const handleTerminalGroupClick = (group: TerminalGroup) => {
    if (openTerminalGroup === group) {
      setOpenTerminalGroup(null);
      setPendingTerminalGroup(null);
      return;
    }

    const sessions = terminalSessionsForGroup(group);
    const targetSession =
      sessions.find((session) => session.terminalId === activeTerminalId) ??
      sessions.find((session) => session.status === "alive") ??
      sessions[0] ??
      null;
    if (!targetSession) return;

    const activeGroup = activeTerminalSession
      ? terminalGroupForSession(activeTerminalSession)
      : null;
    if (activeGroup !== group) {
      onSelectTerminal(targetSession.terminalId);
    }

    if (isBrowserActive) {
      setOpenTerminalGroup(null);
      setPendingTerminalGroup(group);
      return;
    }

    setPendingTerminalGroup(null);
    setOpenTerminalGroup(group);
  };

  const renderTerminalGroupButton = (
    group: TerminalGroup,
    count: number
  ) => {
    const isOpen = openTerminalGroup === group;
    const isGroupActive =
      activeTerminalSession &&
      terminalGroupForSession(activeTerminalSession) === group &&
      (workspaceMode === "terminal" || workspaceMode === "agent");
    const label = group === "agents" ? "Agents" : "Processes";
    const countLabel = count > 99 ? "99+" : String(count);

    return (
      <button
        aria-label={group === "agents" ? "Agent terminals" : "Process terminals"}
        aria-controls="browser-terminal-menu"
        aria-expanded={isOpen && count > 0}
        className={
          isOpen || isGroupActive
            ? `${groupBtnBase} ${
                group === "agents" ? "w-[82px]" : "w-[110px]"
              } bg-secondary/60 text-foreground`
            : `${groupBtnBase} ${
                group === "agents" ? "w-[82px]" : "w-[110px]"
              } text-muted-foreground hover:text-foreground`
        }
        disabled={!projectId || count === 0}
        onClick={() => handleTerminalGroupClick(group)}
        title={group === "agents" ? "Agent terminals" : "Process terminals"}
        type="button"
      >
        <span>{label}</span>
        <span className="min-w-[0.6rem] text-center text-[10px] leading-none tabular-nums">
          {countLabel}
        </span>
      </button>
    );
  };

  return (
    <div className="relative h-12 shrink-0 border-border border-b bg-background">
      <div className="flex h-full items-center gap-2 px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* Segmented bar: Play/Stop, Local */}
          <div className="flex shrink-0 items-center overflow-hidden rounded-md border border-border/80 bg-background">
            {/* Play / Stop */}
            {isAppIdle ? (
              <button
                className={`${segBtnInactive} w-8 disabled:opacity-50`}
                disabled={!projectId}
                onClick={onPlay}
                title="Start app"
                type="button"
              >
                <Play className="size-3.5" />
              </button>
            ) : (
              <button
                className={`${segBtnInactive} w-8`}
                onClick={onStop}
                title={
                  isAppRunning && hasHealthyRuntimeProcess
                    ? "Running (200 OK) — click to stop"
                    : isAppStarting
                      ? "Starting..."
                      : "Running — click to stop"
                }
                type="button"
              >
                <span className="relative">
                  <Square className="size-3" />
                  {healthDotColor && (
                    <span
                      className={`absolute -right-1 -top-1 size-2 rounded-full ${healthDotColor}`}
                    />
                  )}
                </span>
              </button>
            )}

            <span className="h-4 w-px bg-border/60" />

            {/* Local */}
            <button
              className={`${
                isBrowserActive && browserSource === "local"
                  ? segBtnActive
                  : segBtnInactive
              } w-8`}
              onClick={() => {
                onBrowserSourceChange("local");
                if (!isBrowserActive) onWorkspaceModeChange("browser");
              }}
              title="Local dev server"
              type="button"
            >
              <Monitor className="size-3.5" />
            </button>
          </div>

          <div className="relative flex shrink-0 items-center overflow-visible rounded-md border border-border/80 bg-background">
            {renderTerminalGroupButton("processes", processSessions.length)}
            <span className="h-4 w-px bg-border/60" />
            {renderTerminalGroupButton("agents", agentSessions.length)}
            {openTerminalGroup ? (
              <div
                className="absolute left-0 top-full z-50 mt-1 w-[360px] rounded-md border border-border/70 bg-card/95 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
                id="browser-terminal-menu"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="font-vcr text-[11px] uppercase tracking-wide text-muted-foreground">
                    {openTerminalGroupLabel}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      aria-label={`New ${openTerminalGroupLabel.toLowerCase().slice(0, -1)} terminal`}
                      className="inline-flex h-6 min-w-6 items-center justify-center rounded px-1.5 font-code text-[13px] text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                      onClick={() => {
                        if (openTerminalGroup === "agents") {
                          onCreateAgentTerminal();
                        } else {
                          onCreateTerminal();
                        }
                      }}
                      title={
                        openTerminalGroup === "agents"
                          ? "New agent terminal"
                          : "New process terminal"
                      }
                      type="button"
                    >
                      +
                    </button>
                    <button
                      aria-label="Close terminal menu"
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                      onClick={() => setOpenTerminalGroup(null)}
                      type="button"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto rounded-md border border-border/70 bg-background p-1">
                  {openTerminalSessions.length === 0 ? (
                    <p className="px-2 py-3 font-code text-xs text-muted-foreground">
                      No {openTerminalGroupLabel.toLowerCase()} yet.
                    </p>
                  ) : (
                    openTerminalSessions.map((session) => {
                      const isActive =
                        activeTerminalId === session.terminalId &&
                        (isTerminalActive || workspaceMode === "agent");
                      const label = terminalDisplayLabel(session);
                      const detail = sessionDetailLabel(session);

                      return (
                        <div
                          className={`group flex h-9 items-center gap-1 rounded transition-colors ${
                            isActive
                              ? "bg-secondary/60"
                              : "hover:bg-secondary/40"
                          }`}
                          key={session.terminalId}
                        >
                          <button
                            className="flex min-w-0 flex-1 items-center gap-2 px-2 text-left"
                            onClick={() => {
                              onSelectTerminal(session.terminalId);
                              setOpenTerminalGroup(null);
                            }}
                            onMouseDown={(event) => {
                              if (event.button === 1) {
                                event.preventDefault();
                                onRemoveTerminal(session.terminalId);
                              }
                            }}
                            title={label}
                            type="button"
                          >
                            <span className="min-w-0 flex-1 truncate font-vcr text-[12px] uppercase tracking-wide text-foreground">
                              {label}
                            </span>
                            <span className="max-w-40 truncate font-code text-[11px] text-muted-foreground">
                              {detail}
                            </span>
                          </button>
                          <button
                            aria-label={`Close ${label}`}
                            className="mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground/40 opacity-0 transition-[opacity,color,background-color] hover:bg-background hover:text-destructive group-hover:opacity-100"
                            onClick={() =>
                              onRemoveTerminal(session.terminalId)
                            }
                            type="button"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Browser bar */}
          <div
            className={`flex min-w-0 flex-1 items-center rounded-md border bg-background transition-opacity ${
              addressBarError
                ? "border-destructive/70"
                : "border-border/80 focus-within:border-foreground/30"
            } ${!isBrowserActive ? "cursor-pointer opacity-50 hover:opacity-70" : ""}`}
            onClick={!isBrowserActive ? handleBrowserBarClick : undefined}
            onKeyDown={undefined}
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
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isBrowserActive ? (
            <button
              aria-label="Grab element"
              aria-pressed={isGrabbing}
              className={
                isGrabbing
                  ? "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-blue-500/60 bg-blue-500/10 text-blue-500 transition-colors hover:text-blue-400"
                  : "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background text-muted-foreground transition-colors hover:text-foreground disabled:text-muted-foreground/25"
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
            className={
              workspaceMode === "editor"
                ? "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-secondary/60 text-foreground transition-colors"
                : "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background text-muted-foreground transition-colors hover:text-foreground"
            }
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
            className={
              workspaceMode === "skills"
                ? "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-secondary/60 text-foreground transition-colors"
                : "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background text-muted-foreground transition-colors hover:text-foreground"
            }
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
            className={
              workspaceMode === "settings"
                ? "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-secondary/60 text-foreground transition-colors"
                : "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background text-muted-foreground transition-colors hover:text-foreground"
            }
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

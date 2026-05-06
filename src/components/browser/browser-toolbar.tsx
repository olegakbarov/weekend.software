import { useRef } from "react";
import {
  Blocks,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  FileCode2,
  Globe,
  Monitor,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Square,
  Terminal,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import {
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
  onRemoveTerminal,
  // Play
  playState,
  onPlay,
  onStop,
  hasHealthyRuntimeProcess,
  // Browser source
  browserSource,
  onBrowserSourceChange,
  hasDeployUrl,
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
  onRemoveTerminal: (terminalId: string) => void;
  // Play
  playState: PlayState;
  onPlay: () => void;
  onStop: () => void;
  hasHealthyRuntimeProcess: boolean;
  // Browser source
  browserSource: BrowserSource;
  onBrowserSourceChange: (source: BrowserSource) => void;
  hasDeployUrl: boolean;
  onOpenConfigFile: () => void;
}) {
  const isAppIdle = playState === "idle" || playState === "failed";
  const isAppRunning = playState === "running";
  const isAppStarting = playState === "starting";

  const isBrowserActive = workspaceMode === "browser";
  const isTerminalActive = workspaceMode === "terminal";

  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="relative flex h-12 shrink-0 items-center gap-2 border-border border-b px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* Segmented bar: Play/Stop, Local, Web, Terminals, + */}
        <div className="flex shrink-0 items-center overflow-x-auto rounded-md border border-border/80 bg-background scrollbar-none">
          {/* Play / Stop */}
          {isAppIdle ? (
            <button
              className={`${segBtnInactive} px-2.5 disabled:opacity-50`}
              disabled={!projectId}
              onClick={onPlay}
              title="Start app"
              type="button"
            >
              <Play className="size-3.5" />
            </button>
          ) : (
            <button
              className={`${segBtnInactive} px-2.5`}
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

          {/* Web */}
          <button
            className={`${
              isBrowserActive && browserSource === "web"
                ? segBtnActive
                : segBtnInactive
            } w-8`}
            onClick={() => {
              if (hasDeployUrl) {
                onBrowserSourceChange("web");
                if (!isBrowserActive) onWorkspaceModeChange("browser");
              } else {
                onOpenConfigFile();
              }
            }}
            title={
              hasDeployUrl
                ? "Deployed version"
                : "Set runtime.deployUrl in weekend.config.json"
            }
            type="button"
          >
            <Globe className="size-3.5" />
          </button>

          {/* Terminal sessions */}
          {terminalSessions.length > 0 && (
            <span className="h-4 w-px bg-border/60" />
          )}
          {terminalSessions.map((session) => {
            const isActive = activeTerminalId === session.terminalId;
            const label = terminalDisplayLabel(session);
            return (
              <button
                key={session.terminalId}
                className={`group ${
                  isActive && isTerminalActive ? segBtnActive : segBtnInactive
                } gap-1 px-2`}
                onClick={() => onSelectTerminal(session.terminalId)}
                onMouseDown={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    onRemoveTerminal(session.terminalId);
                  }
                }}
                title={label}
                type="button"
              >
                <Terminal className="size-3 shrink-0" />
                <span className="max-w-[60px] truncate font-vcr text-[11px] uppercase tracking-wide">
                  {label}
                </span>
                {isActive && isTerminalActive ? (
                  <span
                    className="shrink-0 rounded p-0.5 text-muted-foreground/30 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveTerminal(session.terminalId);
                    }}
                    onKeyDown={() => {}}
                    role="button"
                    tabIndex={-1}
                  >
                    <X className="size-2.5" />
                  </span>
                ) : null}
              </button>
            );
          })}

          {/* New terminal */}
          {!isAppIdle && (
            <>
              <button
                className={`${segBtnInactive} w-7`}
                disabled={!projectId}
                onClick={onCreateTerminal}
                title="New terminal"
                type="button"
              >
                <Plus className="size-3" />
              </button>
            </>
          )}
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
              onChange={(event) => onAddressBarDraftChange(event.target.value)}
              onClick={!isBrowserActive ? handleBrowserBarClick : undefined}
              placeholder={
                browserSource === "web"
                  ? "Deployed URL"
                  : "Enter URL and press Enter"
              }
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
  );
}

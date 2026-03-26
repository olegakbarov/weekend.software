import { useRef, useEffect, useCallback } from "react";
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
  // Browser source
  browserSource: BrowserSource;
  onBrowserSourceChange: (source: BrowserSource) => void;
  hasDeployUrl: boolean;
  onOpenConfigFile: () => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isAppIdle = playState === "idle" || playState === "failed";

  // Tab index: terminal sessions only (no Local tab)
  const activeTabIndex = activeTerminalId
    ? terminalSessions.findIndex(
        (s) => s.terminalId === activeTerminalId
      )
    : null;

  const TAB_WIDTH = 132;
  // Offset by one tab when the Play tab is present before terminal tabs
  const playTabOffset = isAppIdle ? 1 : 0;
  const tabPlateTranslateX =
    activeTabIndex !== null && activeTabIndex >= 0
      ? (activeTabIndex + playTabOffset) * TAB_WIDTH
      : null;

  // Scroll active terminal tab into view
  useEffect(() => {
    if (activeTabIndex === null || activeTabIndex < 0) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const tabLeft = activeTabIndex * TAB_WIDTH;
    const tabRight = tabLeft + TAB_WIDTH;
    if (tabLeft < container.scrollLeft) {
      container.scrollLeft = tabLeft;
    } else if (tabRight > container.scrollLeft + container.clientWidth) {
      container.scrollLeft = tabRight - container.clientWidth;
    }
  }, [activeTabIndex]);

  const activeTabClass =
    "relative z-10 mx-[5px] my-[6px] inline-flex h-full w-[122px] items-center justify-center gap-1.5 rounded-md px-2.5 font-medium text-foreground transition-colors";
  const inactiveTabClass =
    "relative z-10 mx-[5px] my-[6px] inline-flex h-full w-[122px] items-center justify-center gap-1.5 rounded-md px-2.5 text-foreground/70 transition-colors hover:text-foreground/90";

  const handleTerminalMiddleClick = useCallback(
    (e: React.MouseEvent, terminalId: string) => {
      if (e.button === 1) {
        e.preventDefault();
        onRemoveTerminal(terminalId);
      }
    },
    [onRemoveTerminal]
  );

  const isBrowserActive = workspaceMode === "browser";

  return (
    <div className="relative flex h-12 shrink-0 items-center gap-2 border-border border-b px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* Terminal tab bar */}
        <div
          ref={scrollContainerRef}
          className="neumorph-plate relative inline-flex items-stretch overflow-x-auto rounded-lg p-[3px] scrollbar-none"
        >
          {tabPlateTranslateX !== null ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-[3px] left-[3px] w-[132px] rounded-md border border-border/80 bg-background transition-transform duration-200 ease-out"
              style={{ transform: `translateX(${tabPlateTranslateX}px)` }}
            />
          ) : null}

          {/* Play tab (when app not running) */}
          {isAppIdle && (
            <button
              className={terminalSessions.length === 0 ? activeTabClass : inactiveTabClass}
              disabled={!projectId}
              onClick={onPlay}
              title="Start app"
              type="button"
            >
              <Play className="size-3.5 shrink-0" />
              <span className="max-w-[80px] truncate font-vcr text-[13px] uppercase tracking-wide">
                Start
              </span>
            </button>
          )}

          {/* Dynamic terminal tabs */}
          {terminalSessions.map((session) => {
            const isActive = activeTerminalId === session.terminalId;
            const label = terminalDisplayLabel(session);
            return (
              <button
                key={session.terminalId}
                aria-pressed={isActive}
                className={isActive ? activeTabClass : inactiveTabClass}
                onClick={() => onSelectTerminal(session.terminalId)}
                onMouseDown={(e) =>
                  handleTerminalMiddleClick(e, session.terminalId)
                }
                title={label}
                type="button"
              >
                <Terminal className="size-3.5 shrink-0" />
                <span className="max-w-[80px] truncate font-vcr text-[13px] uppercase tracking-wide">
                  {label}
                </span>
                {isActive ? (
                  <span
                    className="z-20 ml-auto shrink-0 rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-destructive"
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

          {/* New terminal button (only when app is running) */}
          {!isAppIdle && (
            <button
              className="relative z-10 mx-[3px] inline-flex w-7 shrink-0 items-center justify-center self-center rounded-md text-muted-foreground/40 transition-colors hover:text-foreground/70"
              disabled={!projectId}
              onClick={onCreateTerminal}
              title="New terminal"
              type="button"
            >
              <Plus className="size-3.5" />
            </button>
          )}
        </div>

        {/* Local / Web tabs */}
        <div className="flex shrink-0 items-center rounded-md border border-border/80 bg-background">
          <button
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-l-md transition-colors ${
              isBrowserActive && browserSource === "local"
                ? "bg-secondary/60 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              onBrowserSourceChange("local");
              if (!isBrowserActive) onWorkspaceModeChange("browser");
            }}
            title="Local dev server"
            type="button"
          >
            <Monitor className="size-3.5" />
          </button>
          <button
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-r-md transition-colors ${
              isBrowserActive && browserSource === "web"
                ? "bg-secondary/60 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
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
        </div>

        {/* Browser bar — always visible */}
        <div
          className={`flex min-w-0 flex-1 items-center rounded-md border bg-background transition-opacity ${
            addressBarError
              ? "border-destructive/70"
              : "border-border/80 focus-within:border-foreground/30"
          } ${!isBrowserActive ? "cursor-pointer opacity-50 hover:opacity-70" : ""}`}
          onClick={
            !isBrowserActive
              ? () => onWorkspaceModeChange("browser")
              : undefined
          }
          onKeyDown={undefined}
          role={!isBrowserActive ? "button" : undefined}
          tabIndex={!isBrowserActive ? 0 : undefined}
        >
          {/* Address bar */}
          <form
            className="flex min-w-0 flex-1 items-center"
            onSubmit={onNavigateFromAddressBar}
          >
            <input
              aria-invalid={addressBarError ? true : undefined}
              className="h-8 min-w-0 flex-1 bg-transparent px-2 font-code text-xs text-foreground outline-none placeholder:text-muted-foreground/60"
              onChange={(event) => onAddressBarDraftChange(event.target.value)}
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

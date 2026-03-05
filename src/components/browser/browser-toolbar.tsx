import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  FileCode2,
  Globe2,
  RefreshCw,
  Settings,
  Terminal,
} from "lucide-react";
import type { FormEvent } from "react";

type WorkspaceMode =
  | "browser"
  | "editor"
  | "agent"
  | "terminal"
  | "settings";

export function BrowserToolbar({
  workspaceMode,
  onWorkspaceModeChange,
  selectedProject,
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
  // Editor info
  selectedEditorFilePath,
  selectedEditorFileName,
  // Agent info
  agentTerminalLabel,
}: {
  workspaceMode: WorkspaceMode;
  onWorkspaceModeChange: (
    mode: "browser" | "editor" | "agent" | "settings"
  ) => void;
  selectedProject: string | null;
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
  // Editor info
  selectedEditorFilePath: string | null;
  selectedEditorFileName: string | null;
  // Agent info
  agentTerminalLabel?: string | null;
}) {
  const workspaceModeIndex =
    workspaceMode === "browser"
      ? 0
      : workspaceMode === "agent"
        ? 1
        : workspaceMode === "editor"
          ? 2
          : null;
  const TAB_WIDTH = 102;
  const tabPlateTranslateX =
    workspaceModeIndex === null ? null : workspaceModeIndex * TAB_WIDTH;

  return (
    <div className="relative flex h-12 shrink-0 items-center gap-2 border-border border-b px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="neumorph-plate relative inline-flex items-stretch rounded-lg p-[3px]">
          {tabPlateTranslateX !== null ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-[3px] left-[3px] w-[102px] rounded-md border border-border/80 bg-background transition-transform duration-200 ease-out"
              style={{ transform: `translateX(${tabPlateTranslateX}px)` }}
            />
          ) : null}
          <button
            aria-pressed={workspaceMode === "browser"}
            className={
              workspaceMode === "browser"
                ? "relative z-10 mx-[5px] my-[6px] inline-flex h-full w-[92px] items-center justify-center gap-1.5 rounded-md px-2.5 font-medium text-foreground transition-colors"
                : "relative z-10 mx-[5px] my-[6px] inline-flex h-full w-[92px] items-center justify-center gap-1.5 rounded-md px-2.5 text-foreground/70 transition-colors hover:text-foreground/90"
            }
            onClick={() => onWorkspaceModeChange("browser")}
            title="App mode"
            type="button"
          >
            <Globe2 className="size-3.5 shrink-0" />
            <span className="font-vcr text-[13px] uppercase tracking-wide">
              App
            </span>
          </button>
          <button
            aria-pressed={workspaceMode === "agent"}
            className={
              workspaceMode === "agent"
                ? "relative z-10 mx-[5px] my-[6px] inline-flex h-full w-[92px] items-center justify-center gap-1.5 rounded-md px-2.5 font-medium text-foreground transition-colors"
                : "relative z-10 mx-[5px] my-[6px] inline-flex h-full w-[92px] items-center justify-center gap-1.5 rounded-md px-2.5 text-foreground/70 transition-colors hover:text-foreground/90"
            }
            onClick={() => onWorkspaceModeChange("agent")}
            title="Agent mode"
            type="button"
          >
            <Terminal className="size-3.5 shrink-0" />
            <span className="font-vcr text-[13px] uppercase tracking-wide">
              Agent
            </span>
          </button>
          <button
            aria-pressed={workspaceMode === "editor"}
            className={
              workspaceMode === "editor"
                ? "relative z-10 mx-[5px] my-[6px] inline-flex h-full w-[92px] items-center justify-center gap-1.5 rounded-md px-2.5 font-medium text-foreground transition-colors"
                : "relative z-10 mx-[5px] my-[6px] inline-flex h-full w-[92px] items-center justify-center gap-1.5 rounded-md px-2.5 text-foreground/70 transition-colors hover:text-foreground/90"
            }
            onClick={() => onWorkspaceModeChange("editor")}
            title="Files mode"
            type="button"
          >
            <FileCode2 className="size-3.5 shrink-0" />
            <span className="font-vcr text-[13px] uppercase tracking-wide">
              Files
            </span>
          </button>
        </div>

        {workspaceMode === "browser" ? (
          <form
            className={`flex min-w-0 flex-1 items-center rounded-md border bg-background ${
              addressBarError
                ? "border-destructive/70"
                : "border-border/80 focus-within:border-foreground/30"
            }`}
            onSubmit={onNavigateFromAddressBar}
          >
            <input
              aria-invalid={addressBarError ? true : undefined}
              className="h-8 min-w-0 flex-1 bg-transparent px-2 font-code text-xs text-foreground outline-none placeholder:text-muted-foreground/60"
              onChange={(event) => onAddressBarDraftChange(event.target.value)}
              placeholder="Enter URL and press Enter"
              spellCheck={false}
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
        ) : workspaceMode === "editor" ? (
          <div className="min-w-0 flex h-8 flex-1 items-center rounded-md border border-border/80 bg-background px-2.5">
            {selectedEditorFilePath ? (
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 font-code text-xs text-foreground/90">
                  {selectedEditorFileName}
                </span>
                <span
                  className="truncate font-code text-[13px] text-muted-foreground/60"
                  title={selectedEditorFilePath}
                >
                  {selectedEditorFilePath}
                </span>
              </div>
            ) : (
              <span className="font-code text-xs text-muted-foreground/60">
                Select a file
              </span>
            )}
          </div>
        ) : workspaceMode === "settings" ? (
          <div className="min-w-0 flex h-8 flex-1 items-center rounded-md border border-border/80 bg-background px-2.5">
            <span className="font-code text-xs text-muted-foreground/70">
              Project settings
            </span>
          </div>
        ) : (
          <div className="min-w-0 flex h-8 flex-1 items-center rounded-md border border-border/80 bg-background px-2.5">
            <span className="font-code text-xs text-muted-foreground/70">
              {agentTerminalLabel || "Terminal"}
            </span>
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {workspaceMode === "browser" ? (
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
          aria-label="Project settings"
          aria-pressed={workspaceMode === "settings"}
          className={
            workspaceMode === "settings"
              ? "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-secondary/60 text-foreground transition-colors"
              : "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background text-muted-foreground transition-colors hover:text-foreground"
          }
          disabled={!selectedProject}
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

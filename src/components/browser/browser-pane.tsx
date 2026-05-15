import { AlertTriangle, Loader2, Play, RefreshCw } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import type {
  PlayState,
  ProjectConfigReadSnapshot,
  TerminalSessionDescriptor,
} from "@/lib/controller";
import {
  buildManagedBrowserWebviewCacheKey,
  getMostRecentManagedBrowserWebviewForProject,
} from "@/lib/browser-webview-manager";
import { loadProjectPreview, onPreviewCaptured } from "@/lib/project-preview";
import { MOCK_MODE } from "@/lib/tauri-mock";
import {
  buildBrowserSurfaceUrl,
  isCrossProjectLocalDevUrl,
  preferCachedBrowserValue,
  shouldHydrateBrowserValueFromConfiguredRuntime,
} from "./browser-url-utils";
import {
  resolveBrowserRuntimeTarget,
  shouldRenderNativeBrowserWebviewHost,
} from "./browser-runtime";
import {
  BrowserToolbar,
  TerminalTabStrip,
  groupTerminalSessions,
  type BrowserLayoutMode,
} from "./browser-toolbar";
import { useBrowserWebview } from "./browser-webview";

type WorkspaceMode = "browser" | "editor" | "agent" | "terminal" | "settings";

export function BrowserPane({
  projectKey,
  filesystemEventVersion,
  hasHealthyRuntimeProcess,
  projectConfigSnapshot,
  isProjectConfigLoading,
  projectConfigError,
  workspaceMode,
  onWorkspaceModeChange,
  onPlayProject,
  onRestartApp,
  playState,
  playError,
  editorContent,
  settingsContent,
  agentContent,
  terminalSessions,
  activeTerminalId,
  onSelectTerminal,
  onRemoveTerminal,
  onCreateTerminal,
  onCreateAgentTerminal,
  onOpenConfigFile,
  onElementGrabbed,
}: {
  projectKey: string;
  filesystemEventVersion: number;
  hasHealthyRuntimeProcess: boolean;
  projectConfigSnapshot: ProjectConfigReadSnapshot | null;
  isProjectConfigLoading: boolean;
  projectConfigError: string | null;
  workspaceMode: WorkspaceMode;
  onWorkspaceModeChange: (
    mode: "browser" | "editor" | "agent" | "settings",
  ) => void;
  onPlayProject: () => void;
  onRestartApp: () => void;
  playState: PlayState;
  playError?: string | null;
  editorContent?: ReactNode;
  settingsContent?: ReactNode;
  agentContent?: ReactNode;
  // Terminal tabs
  terminalSessions: TerminalSessionDescriptor[];
  activeTerminalId: string | null;
  onSelectTerminal: (terminalId: string) => void;
  onRemoveTerminal: (terminalId: string) => void;
  onCreateTerminal: () => void;
  onCreateAgentTerminal: () => void;
  onOpenConfigFile: () => void;
  onElementGrabbed?: (data: {
    tag: string;
    id: string;
    className: string;
    text: string;
    selector: string;
    outerHTML?: string;
  }) => void;
}) {
  const [frameVersionByProject, setFrameVersionByProject] = useState<
    Record<string, number>
  >({});
  const cachedProjectWebview =
    getMostRecentManagedBrowserWebviewForProject(projectKey);
  const frameVersion =
    frameVersionByProject[projectKey] ??
    cachedProjectWebview?.frameVersion ??
    0;
  const [navigationUrlByProject, setNavigationUrlByProject] = useState<
    Record<string, string>
  >({});
  const [currentPageUrlByProject, setCurrentPageUrlByProject] = useState<
    Record<string, string>
  >({});
  const [urlInputDraftByProject, setUrlInputDraftByProject] = useState<
    Record<string, string>
  >({});
  const [layoutModeByProject, setLayoutModeByProject] = useState<
    Record<string, BrowserLayoutMode>
  >({});
  const previousProjectKeyRef = useRef<string | null>(null);
  const layoutMode = layoutModeByProject[projectKey] ?? "single";
  const isTerminalMode =
    workspaceMode === "terminal" || workspaceMode === "agent";
  const isSplitLayoutActive = layoutMode === "split";
  // In split layout the left pane is always the browser; selecting a terminal
  // tab on the right must not hide the native webview or swap the left pane.
  const isBrowserPaneVisible =
    workspaceMode === "browser" || (isSplitLayoutActive && isTerminalMode);

  const browserTarget = useMemo(
    () =>
      resolveBrowserRuntimeTarget({
        projectId: projectKey,
        playState,
        hasHealthyRuntimeProcess,
        isProjectConfigLoading,
        projectConfigError,
        projectConfigSnapshot,
      }),
    [
      projectKey,
      playState,
      hasHealthyRuntimeProcess,
      isProjectConfigLoading,
      projectConfigError,
      projectConfigSnapshot,
    ],
  );
  const configuredRuntimeUrl = browserTarget.url;
  const cachedFrameWebview =
    cachedProjectWebview?.cacheKey ===
    buildManagedBrowserWebviewCacheKey(projectKey, frameVersion)
      ? cachedProjectWebview
      : null;
  const storedNavigationUrl = preferCachedBrowserValue(
    cachedFrameWebview?.lastUrl,
    navigationUrlByProject[projectKey],
  );
  const storedCurrentPageUrl = preferCachedBrowserValue(
    cachedFrameWebview?.lastUrl,
    currentPageUrlByProject[projectKey],
  );
  const storedUrlInputDraft = preferCachedBrowserValue(
    cachedFrameWebview?.lastUrl,
    urlInputDraftByProject[projectKey],
  );
  const hasNavigationOriginMismatch =
    !!configuredRuntimeUrl &&
    !!storedNavigationUrl &&
    isCrossProjectLocalDevUrl(storedNavigationUrl, configuredRuntimeUrl);
  const hasCurrentPageOriginMismatch =
    !!configuredRuntimeUrl &&
    !!storedCurrentPageUrl &&
    isCrossProjectLocalDevUrl(storedCurrentPageUrl, configuredRuntimeUrl);
  const hasDraftOriginMismatch =
    !!configuredRuntimeUrl &&
    !!storedUrlInputDraft &&
    isCrossProjectLocalDevUrl(storedUrlInputDraft, configuredRuntimeUrl);
  const hasCrossProjectLocalDevMismatch =
    hasNavigationOriginMismatch ||
    hasCurrentPageOriginMismatch ||
    hasDraftOriginMismatch;
  const isRestoringCachedBrowserFrame =
    !!cachedFrameWebview &&
    cachedFrameWebview.isReady &&
    !hasCrossProjectLocalDevMismatch &&
    playState === "running";
  const cachedBrowserRestoreUrl = isRestoringCachedBrowserFrame
    ? cachedFrameWebview.lastUrl
    : null;
  const navigationUrl =
    browserTarget.status === "ready"
      ? hasNavigationOriginMismatch
        ? configuredRuntimeUrl
        : (storedNavigationUrl ?? configuredRuntimeUrl)
      : cachedBrowserRestoreUrl;
  const currentPageUrl =
    browserTarget.status === "ready"
      ? hasCurrentPageOriginMismatch
        ? navigationUrl
        : (storedCurrentPageUrl ?? navigationUrl)
      : cachedBrowserRestoreUrl;
  const urlInputDraft =
    browserTarget.status === "ready"
      ? hasDraftOriginMismatch
        ? (navigationUrl ?? "")
        : (storedUrlInputDraft ?? currentPageUrl ?? "")
      : (cachedBrowserRestoreUrl ?? "");
  const isEmbeddedBrowserAvailable = !MOCK_MODE;
  const shouldKeepPreviousSurfaceWhenUnavailable =
    isBrowserPaneVisible &&
    playState === "running" &&
    !projectConfigError &&
    (isProjectConfigLoading || !projectConfigSnapshot);

  const effectiveNavigationUrl = navigationUrl;
  const effectiveUrlInputDraft = urlInputDraft;

  const runtimeSurfaceUrl = useMemo(
    () =>
      effectiveNavigationUrl
        ? buildBrowserSurfaceUrl(effectiveNavigationUrl)
        : null,
    [effectiveNavigationUrl],
  );

  // --- Stable callbacks for the webview hook ---

  const onCurrentPageUrlChange = useCallback((pk: string, url: string) => {
    setCurrentPageUrlByProject((prev) => ({ ...prev, [pk]: url }));
  }, []);

  const onUrlInputDraftChange = useCallback((pk: string, url: string) => {
    setUrlInputDraftByProject((prev) => ({ ...prev, [pk]: url }));
  }, []);

  const onNavigationUrlChange = useCallback((pk: string, url: string) => {
    setNavigationUrlByProject((prev) => ({ ...prev, [pk]: url }));
  }, []);

  const onFrameVersionIncrement = useCallback((pk: string) => {
    setFrameVersionByProject((prev) => ({
      ...prev,
      [pk]: (prev[pk] ?? 0) + 1,
    }));
  }, []);

  // --- Webview hook ---

  const {
    isFrameLoading,
    frameErrorMessage,
    isStartupLoading,
    startupProbeErrorMessage,
    displayRuntimeSurfaceUrl,
    isGrabbing,
    toggleElementGrab,
    reloadCurrentPage,
    nativeWebviewHostRef,
  } = useBrowserWebview({
    projectKey,
    frameVersion,
    navigationUrl: effectiveNavigationUrl,
    currentPageUrl,
    configuredRuntimeUrl,
    runtimeSurfaceUrl,
    workspaceMode,
    isBrowserPaneVisible,
    shouldKeepPreviousSurfaceWhenUnavailable,
    playState,
    filesystemEventVersion,
    onCurrentPageUrlChange,
    onUrlInputDraftChange,
    onNavigationUrlChange,
    onFrameVersionIncrement,
    onElementGrabbed,
  });

  // --- Preserve the active page when switching between projects ---

  useEffect(() => {
    const previousProjectKey = previousProjectKeyRef.current;
    if (previousProjectKey && previousProjectKey !== projectKey) {
      const previousProjectPageUrl =
        currentPageUrlByProject[previousProjectKey]?.trim() ?? "";
      if (previousProjectPageUrl) {
        setNavigationUrlByProject((previous) => {
          if (previous[previousProjectKey] === previousProjectPageUrl) {
            return previous;
          }

          return {
            ...previous,
            [previousProjectKey]: previousProjectPageUrl,
          };
        });
      }
    }

    previousProjectKeyRef.current = projectKey;
  }, [currentPageUrlByProject, projectKey]);

  // --- Sync configured runtime URL into per-project state ---

  useEffect(() => {
    if (!configuredRuntimeUrl) return;
    const shouldHydrateNavigationUrl =
      shouldHydrateBrowserValueFromConfiguredRuntime(
        storedNavigationUrl,
        configuredRuntimeUrl,
      );
    const shouldHydrateCurrentPageUrl =
      shouldHydrateBrowserValueFromConfiguredRuntime(
        storedCurrentPageUrl,
        configuredRuntimeUrl,
      );
    const shouldHydrateDraftUrl =
      shouldHydrateBrowserValueFromConfiguredRuntime(
        storedUrlInputDraft,
        configuredRuntimeUrl,
      );

    if (
      !shouldHydrateNavigationUrl &&
      !shouldHydrateCurrentPageUrl &&
      !shouldHydrateDraftUrl
    ) {
      return;
    }

    if (hasCrossProjectLocalDevMismatch) {
      console.info("[Browser] restoring configured runtime origin", {
        projectKey,
        configuredRuntimeUrl,
        navigationUrl: storedNavigationUrl,
        currentPageUrl: storedCurrentPageUrl,
        urlInputDraft: storedUrlInputDraft,
      });
    }

    if (shouldHydrateNavigationUrl) {
      setNavigationUrlByProject((previous) => ({
        ...previous,
        [projectKey]: configuredRuntimeUrl,
      }));
    }
    if (shouldHydrateCurrentPageUrl) {
      setCurrentPageUrlByProject((previous) => ({
        ...previous,
        [projectKey]: configuredRuntimeUrl,
      }));
    }
    if (shouldHydrateDraftUrl) {
      setUrlInputDraftByProject((previous) => ({
        ...previous,
        [projectKey]: configuredRuntimeUrl,
      }));
    }

    // Note: previously we bumped `frameVersion` here when the hydrated
    // navigation URL differed from the stored one. With navigate-in-place via
    // the cache-aware lifecycle in `useBrowserWebview`, that bump is wasteful
    // (it would force teardown and recreate). The URL change is now synced
    // automatically through the new `navigate` path on the existing webview.
  }, [
    configuredRuntimeUrl,
    hasCrossProjectLocalDevMismatch,
    projectKey,
    storedCurrentPageUrl,
    storedNavigationUrl,
    storedUrlInputDraft,
  ]);

  const hasBrowserUrl =
    isEmbeddedBrowserAvailable && Boolean(effectiveNavigationUrl);
  const effectiveBrowserErrorMessage =
    startupProbeErrorMessage ?? frameErrorMessage;
  const failureDiagnostic =
    playError?.trim() ||
    effectiveBrowserErrorMessage ||
    browserTarget.message ||
    "The runtime exited before the app became available.";
  const retryBrowserLoad = () => {
    if (startupProbeErrorMessage) {
      onRestartApp();
      return;
    }
    reloadCurrentPage();
  };

  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setPreviewSrc(null);
    void loadProjectPreview(projectKey).then((dataUrl) => {
      if (!cancelled) setPreviewSrc(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [projectKey]);

  useEffect(() => {
    return onPreviewCaptured((project, dataUrl) => {
      if (project === projectKey) setPreviewSrc(dataUrl);
    });
  }, [projectKey]);

  const shouldShowFrameLoading =
    playState !== "running" && isFrameLoading && !isRestoringCachedBrowserFrame;
  const isAwakening =
    !!effectiveBrowserErrorMessage ||
    isStartupLoading ||
    shouldShowFrameLoading ||
    playState !== "running" ||
    (browserTarget.status !== "ready" && !isRestoringCachedBrowserFrame) ||
    !displayRuntimeSurfaceUrl;
  const shouldMountNativeBrowserHost = shouldRenderNativeBrowserWebviewHost({
    browserTargetStatus: browserTarget.status,
    displayRuntimeSurfaceUrl,
    isEmbeddedBrowserAvailable,
    isRestoringCachedBrowserFrame,
  });

  const awakeningStatus:
    | { kind: "button" }
    | { kind: "text"; message: string }
    | null = (() => {
    if (playState === "failed") return null; // failed block has its own treatment
    if (effectiveBrowserErrorMessage) return null; // error block has its own treatment
    if (playState === "starting" || isStartupLoading) {
      return { kind: "text", message: "Starting..." };
    }
    if (shouldShowFrameLoading) {
      return { kind: "text", message: "Loading app..." };
    }
    if (browserTarget.action === "play") {
      return { kind: "button" };
    }
    if (browserTarget.message && !isRestoringCachedBrowserFrame) {
      return { kind: "text", message: browserTarget.message };
    }
    return null;
  })();

  const configuredProcesses = projectConfigSnapshot?.processes ?? {};
  const { processSessions, agentSessions } = useMemo(
    () => groupTerminalSessions(terminalSessions, configuredProcesses),
    [configuredProcesses, terminalSessions],
  );

  const handleLayoutModeChange = useCallback(
    (mode: BrowserLayoutMode) => {
      setLayoutModeByProject((prev) => {
        if (prev[projectKey] === mode) return prev;
        return { ...prev, [projectKey]: mode };
      });
    },
    [projectKey],
  );

  const terminalPaneContent = agentContent ?? (
    <div className="flex h-full items-center justify-center">
      <p className="font-code text-sm text-muted-foreground/50">
        Agent terminal
      </p>
    </div>
  );

  const browserPaneContent = (
    <div className="relative h-full min-h-0 bg-background">
      {shouldMountNativeBrowserHost ? (
        <div
          aria-hidden={!isBrowserPaneVisible}
          className={
            isBrowserPaneVisible
              ? "absolute inset-0"
              : "pointer-events-none absolute inset-0 opacity-0"
          }
        >
          <div
            className="h-full w-full bg-background"
            ref={nativeWebviewHostRef}
          />
        </div>
      ) : null}

      {browserTarget.status === "ready" && !isEmbeddedBrowserAvailable ? (
        <div className="flex h-full items-center justify-center px-4">
          <div className="max-w-xl rounded-md border border-border bg-background p-4 text-center">
            <p className="font-code text-xs text-foreground">
              Browser pane is available only in the desktop app.
            </p>
            <p className="mt-2 font-code text-xs text-muted-foreground">
              Run `pnpm tauri:dev` to use the embedded browser.
            </p>
          </div>
        </div>
      ) : (
        <div
          aria-hidden={!isAwakening}
          className={`absolute inset-0 ${
            isAwakening ? "" : "pointer-events-none"
          }`}
        >
          {previewSrc ? (
            <img
              aria-hidden
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-60 grayscale"
              src={previewSrc}
            />
          ) : null}

          {playState === "failed" ? (
            <div className="absolute inset-0 flex items-center justify-center px-4">
              <div
                className="w-full max-w-[30rem] rounded-md bg-background/95 p-4 text-left shadow-[0_0_0_1px_rgba(248,113,113,0.28),0_18px_50px_-24px_rgba(0,0,0,0.72)] backdrop-blur-sm"
                role="alert"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                    <AlertTriangle aria-hidden className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-vcr text-[13px] text-foreground">
                      Project failed to run
                    </p>
                    <p className="mt-1 break-words font-code text-xs leading-5 text-muted-foreground">
                      {failureDiagnostic}
                    </p>
                    <button
                      className="mt-4 inline-flex h-8 items-center gap-2 rounded-md bg-foreground px-3 font-vcr text-[11px] text-background shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_10px_24px_-16px_rgba(0,0,0,0.9)] transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:scale-[1.02] active:scale-[0.96]"
                      onClick={onRestartApp}
                      type="button"
                    >
                      <RefreshCw aria-hidden className="size-3" />
                      <span className="leading-none">RESTART</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : effectiveBrowserErrorMessage ? (
            <div className="absolute inset-0 flex items-center justify-center px-4">
              <div className="max-w-md rounded-md border border-border bg-background/90 p-4 text-center backdrop-blur-sm">
                <p className="font-code text-xs text-foreground">
                  {effectiveBrowserErrorMessage}
                </p>
                <button
                  className="mt-3 rounded border border-border px-3 py-1.5 font-code text-xs text-muted-foreground transition-colors hover:text-foreground"
                  onClick={retryBrowserLoad}
                  type="button"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : awakeningStatus ? (
            <div className="absolute inset-0 flex items-center justify-center px-4">
              <button
                type="button"
                aria-label={
                  awakeningStatus.kind === "text"
                    ? awakeningStatus.message
                    : "Start project"
                }
                aria-busy={awakeningStatus.kind !== "button"}
                disabled={awakeningStatus.kind !== "button"}
                onClick={
                  awakeningStatus.kind === "button" ? onPlayProject : undefined
                }
                className={cn(
                  "group relative flex h-28 w-28 items-center justify-center rounded-full",
                  "bg-gradient-to-b from-emerald-300 via-emerald-500 to-emerald-700",
                  "shadow-[0_0_0_1.5px_rgba(15,23,42,0.85),0_0_0_4px_rgba(74,222,128,0.45),0_0_28px_rgba(34,197,94,0.45),0_10px_24px_-6px_rgba(0,0,0,0.5),inset_0_8px_16px_-8px_rgba(255,255,255,0.7),inset_0_-10px_18px_-8px_rgba(0,0,0,0.35),inset_0_0_0_1px_rgba(255,255,255,0.18)]",
                  "transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
                  "cursor-pointer hover:enabled:scale-[1.04] active:enabled:scale-[0.96]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  "disabled:cursor-default disabled:saturate-[.75]",
                )}
              >
                {awakeningStatus.kind === "button" ? (
                  <Play
                    aria-hidden
                    className="size-12 translate-x-[1.5px] fill-white text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                    strokeWidth={1.25}
                  />
                ) : (
                  <Loader2
                    aria-hidden
                    className="size-10 animate-spin text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
                    strokeWidth={2.5}
                  />
                )}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <BrowserToolbar
        workspaceMode={workspaceMode}
        layoutMode={layoutMode}
        onLayoutModeChange={handleLayoutModeChange}
        onWorkspaceModeChange={onWorkspaceModeChange}
        projectId={projectKey}
        urlInputDraft={effectiveUrlInputDraft}
        hasBrowserUrl={hasBrowserUrl}
        onReloadCurrentPage={reloadCurrentPage}
        isGrabbing={isGrabbing}
        onToggleElementGrab={toggleElementGrab}
        terminalSessions={terminalSessions}
        configuredProcesses={projectConfigSnapshot?.processes ?? {}}
        activeTerminalId={activeTerminalId}
        onSelectTerminal={onSelectTerminal}
        onRemoveTerminal={onRemoveTerminal}
        onCreateTerminal={onCreateTerminal}
        onCreateAgentTerminal={onCreateAgentTerminal}
        onOpenConfigFile={onOpenConfigFile}
        showTerminalTabs={!isSplitLayoutActive}
      />

      <div className="relative flex min-h-0 flex-1 bg-background">
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          {browserPaneContent}

          {workspaceMode === "editor" ? (
            <div className="absolute inset-0 bg-background">
              {editorContent ?? (
                <div className="flex h-full items-center justify-center">
                  <p className="font-code text-sm text-muted-foreground/50">
                    Select a file to edit
                  </p>
                </div>
              )}
            </div>
          ) : workspaceMode === "settings" ? (
            <div className="absolute inset-0 bg-background">
              {settingsContent ?? (
                <div className="flex h-full items-center justify-center">
                  <p className="font-code text-sm text-muted-foreground/50">
                    Project settings
                  </p>
                </div>
              )}
            </div>
          ) : isTerminalMode && !isSplitLayoutActive ? (
            <div className="absolute inset-0 bg-background">
              {terminalPaneContent}
            </div>
          ) : null}
        </div>

        {isSplitLayoutActive ? (
          <>
            <div className="w-px shrink-0 bg-border/70" />
            <div className="flex w-1/2 min-h-0 min-w-0 shrink-0 flex-col bg-background">
              <div className="shrink-0 border-b border-border/80 p-2">
                <TerminalTabStrip
                  processSessions={processSessions}
                  agentSessions={agentSessions}
                  activeTerminalId={activeTerminalId}
                  isActiveMode={isTerminalMode}
                  onSelect={onSelectTerminal}
                  onRemove={onRemoveTerminal}
                  onCreateProcess={onCreateTerminal}
                  onCreateAgent={onCreateAgentTerminal}
                  disabled={!projectKey}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                {terminalPaneContent}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

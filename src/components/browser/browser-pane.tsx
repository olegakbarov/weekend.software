import { Loader2, Play } from "lucide-react";
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
  shouldHydrateBrowserValueFromConfiguredRuntime,
} from "./browser-url-utils";
import {
  resolveBrowserRuntimeTarget,
} from "./browser-runtime";
import { BrowserToolbar } from "./browser-toolbar";
import { useBrowserWebview } from "./browser-webview";

type WorkspaceMode =
  | "browser"
  | "editor"
  | "agent"
  | "terminal"
  | "settings";

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
    mode: "browser" | "editor" | "agent" | "settings"
  ) => void;
  onPlayProject: () => void;
  onRestartApp: () => void;
  playState: PlayState;
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
    frameVersionByProject[projectKey] ?? cachedProjectWebview?.frameVersion ?? 0;
  const [navigationUrlByProject, setNavigationUrlByProject] = useState<
    Record<string, string>
  >({});
  const [currentPageUrlByProject, setCurrentPageUrlByProject] = useState<
    Record<string, string>
  >({});
  const [urlInputDraftByProject, setUrlInputDraftByProject] = useState<
    Record<string, string>
  >({});
  const previousProjectKeyRef = useRef<string | null>(null);

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
    ]
  );
  const configuredRuntimeUrl = browserTarget.url;
  const cachedFrameWebview =
    cachedProjectWebview?.cacheKey ===
    buildManagedBrowserWebviewCacheKey(projectKey, frameVersion)
      ? cachedProjectWebview
      : null;
  const storedNavigationUrl =
    navigationUrlByProject[projectKey] ?? cachedFrameWebview?.lastUrl ?? null;
  const storedCurrentPageUrl =
    currentPageUrlByProject[projectKey] ?? cachedFrameWebview?.lastUrl ?? null;
  const storedUrlInputDraft =
    urlInputDraftByProject[projectKey] ?? cachedFrameWebview?.lastUrl ?? null;
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
  const navigationUrl =
    browserTarget.status === "ready"
      ? hasNavigationOriginMismatch
        ? configuredRuntimeUrl
        : storedNavigationUrl ?? configuredRuntimeUrl
      : null;
  const currentPageUrl =
    browserTarget.status === "ready"
      ? hasCurrentPageOriginMismatch
        ? navigationUrl
        : storedCurrentPageUrl ?? navigationUrl
      : null;
  const urlInputDraft =
    browserTarget.status === "ready"
      ? hasDraftOriginMismatch
        ? navigationUrl ?? ""
        : storedUrlInputDraft ?? currentPageUrl ?? ""
      : "";
  const isEmbeddedBrowserAvailable = !MOCK_MODE;

  const effectiveNavigationUrl = navigationUrl;
  const effectiveUrlInputDraft = urlInputDraft;

  const runtimeSurfaceUrl = useMemo(
    () =>
      effectiveNavigationUrl
        ? buildBrowserSurfaceUrl(effectiveNavigationUrl)
        : null,
    [effectiveNavigationUrl]
  );

  // --- Stable callbacks for the webview hook ---

  const onCurrentPageUrlChange = useCallback(
    (pk: string, url: string) => {
      setCurrentPageUrlByProject((prev) => ({ ...prev, [pk]: url }));
    },
    []
  );

  const onUrlInputDraftChange = useCallback(
    (pk: string, url: string) => {
      setUrlInputDraftByProject((prev) => ({ ...prev, [pk]: url }));
    },
    []
  );

  const onNavigationUrlChange = useCallback(
    (pk: string, url: string) => {
      setNavigationUrlByProject((prev) => ({ ...prev, [pk]: url }));
    },
    []
  );

  const onFrameVersionIncrement = useCallback(
    (pk: string) => {
      setFrameVersionByProject((prev) => ({
        ...prev,
        [pk]: (prev[pk] ?? 0) + 1,
      }));
    },
    []
  );

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
        configuredRuntimeUrl
      );
    const shouldHydrateCurrentPageUrl =
      shouldHydrateBrowserValueFromConfiguredRuntime(
        storedCurrentPageUrl,
        configuredRuntimeUrl
      );
    const shouldHydrateDraftUrl =
      shouldHydrateBrowserValueFromConfiguredRuntime(
        storedUrlInputDraft,
        configuredRuntimeUrl
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

  const isAwakening =
    !!effectiveBrowserErrorMessage ||
    isStartupLoading ||
    isFrameLoading ||
    playState !== "running" ||
    browserTarget.status !== "ready" ||
    !displayRuntimeSurfaceUrl;

  const awakeningStatus: { kind: "button" } | { kind: "text"; message: string } | null = (() => {
    if (effectiveBrowserErrorMessage) return null; // error block has its own treatment
    if (playState === "starting" || isStartupLoading) {
      return { kind: "text", message: "Starting..." };
    }
    if (isFrameLoading) {
      return { kind: "text", message: "Loading app..." };
    }
    if (browserTarget.action === "play") {
      return { kind: "button" };
    }
    if (browserTarget.message) {
      return { kind: "text", message: browserTarget.message };
    }
    return null;
  })();

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <BrowserToolbar
        workspaceMode={workspaceMode}
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
      />

      <div className="relative min-h-0 flex-1 bg-background">
        {isEmbeddedBrowserAvailable &&
        browserTarget.status === "ready" &&
        displayRuntimeSurfaceUrl ? (
          <div
            aria-hidden={workspaceMode !== "browser"}
            className={
              workspaceMode === "browser"
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


        {workspaceMode === "editor" ? (
          editorContent ?? (
            <div className="flex h-full items-center justify-center">
              <p className="font-code text-sm text-muted-foreground/50">
                Select a file to edit
              </p>
            </div>
          )
        ) : workspaceMode === "settings" ? (
          settingsContent ?? (
            <div className="flex h-full items-center justify-center">
              <p className="font-code text-sm text-muted-foreground/50">
                Project settings
              </p>
            </div>
          )
        ) : workspaceMode === "agent" || workspaceMode === "terminal" ? (
          agentContent ?? (
            <div className="flex h-full items-center justify-center">
              <p className="font-code text-sm text-muted-foreground/50">
                Agent terminal
              </p>
            </div>
          )
        ) : browserTarget.status === "ready" && !isEmbeddedBrowserAvailable ? (
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
          <>
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

              {effectiveBrowserErrorMessage ? (
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
                      awakeningStatus.kind === "button"
                        ? onPlayProject
                        : undefined
                    }
                    className={cn(
                      "group relative flex h-28 w-28 items-center justify-center rounded-full",
                      "bg-gradient-to-b from-emerald-300 via-emerald-500 to-emerald-700",
                      "shadow-[0_0_0_1.5px_rgba(15,23,42,0.85),0_0_0_4px_rgba(74,222,128,0.45),0_0_28px_rgba(34,197,94,0.45),0_10px_24px_-6px_rgba(0,0,0,0.5),inset_0_8px_16px_-8px_rgba(255,255,255,0.7),inset_0_-10px_18px_-8px_rgba(0,0,0,0.35),inset_0_0_0_1px_rgba(255,255,255,0.18)]",
                      "transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
                      "cursor-pointer hover:enabled:scale-[1.04] active:enabled:scale-[0.96]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      "disabled:cursor-default disabled:saturate-[.75]"
                    )}
                  >
                    {awakeningStatus.kind === "button" ? (
                      <Play
                        aria-hidden
                        className="h-12 w-12 translate-x-[1.5px] fill-white text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                        strokeWidth={1.25}
                      />
                    ) : (
                      <Loader2
                        aria-hidden
                        className="h-10 w-10 animate-spin text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
                        strokeWidth={2.5}
                      />
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

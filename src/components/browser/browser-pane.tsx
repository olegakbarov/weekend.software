import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  PlayState,
  ProjectConfigReadSnapshot,
  TerminalSessionDescriptor,
} from "@/lib/controller";
import { MOCK_MODE } from "@/lib/tauri-mock";
import {
  buildBrowserSurfaceUrl,
  isCrossProjectLocalDevUrl,
  normalizeNavigableUrl,
  shouldHydrateBrowserValueFromConfiguredRuntime,
} from "./browser-url-utils";
import {
  resolveBrowserRuntimeTarget,
} from "./browser-runtime";
import { BrowserToolbar, type BrowserSource } from "./browser-toolbar";
import { useBrowserWebview } from "./browser-webview";

type WorkspaceMode =
  | "browser"
  | "editor"
  | "agent"
  | "terminal"
  | "settings"
  | "skills";

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
  onStopProject,
  onRestartApp,
  playState,
  editorContent,
  settingsContent,
  skillsContent,
  agentContent,
  terminalSessions,
  activeTerminalId,
  onSelectTerminal,
  onCreateTerminal,
  onCreateAgentTerminal,
  onRemoveTerminal,
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
    mode: "browser" | "editor" | "agent" | "settings" | "skills"
  ) => void;
  onPlayProject: () => void;
  onStopProject: () => void;
  onRestartApp: () => void;
  playState: PlayState;
  editorContent?: ReactNode;
  settingsContent?: ReactNode;
  skillsContent?: ReactNode;
  agentContent?: ReactNode;
  // Terminal tabs
  terminalSessions: TerminalSessionDescriptor[];
  activeTerminalId: string | null;
  onSelectTerminal: (terminalId: string) => void;
  onCreateTerminal: () => void;
  onCreateAgentTerminal: () => void;
  onRemoveTerminal: (terminalId: string) => void;
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
  const [browserSource, setBrowserSource] = useState<BrowserSource>("local");
  const deployUrl = projectConfigSnapshot?.deployUrl?.trim() || null;
  const hasDeployUrl = !!deployUrl;

  // Reset to local when deploy URL disappears
  useEffect(() => {
    if (browserSource === "web" && !hasDeployUrl) {
      setBrowserSource("local");
    }
  }, [browserSource, hasDeployUrl]);

  const [frameVersionByProject, setFrameVersionByProject] = useState<
    Record<string, number>
  >({});
  const frameVersion = frameVersionByProject[projectKey] ?? 0;
  const [navigationUrlByProject, setNavigationUrlByProject] = useState<
    Record<string, string>
  >({});
  const [currentPageUrlByProject, setCurrentPageUrlByProject] = useState<
    Record<string, string>
  >({});
  const [urlInputDraftByProject, setUrlInputDraftByProject] = useState<
    Record<string, string>
  >({});
  const [addressBarErrorByProject, setAddressBarErrorByProject] = useState<
    Record<string, string | null>
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
  const storedNavigationUrl = navigationUrlByProject[projectKey] ?? null;
  const storedCurrentPageUrl = currentPageUrlByProject[projectKey] ?? null;
  const storedUrlInputDraft = urlInputDraftByProject[projectKey] ?? null;
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
  const addressBarError = addressBarErrorByProject[projectKey] ?? null;
  const isEmbeddedBrowserAvailable = !MOCK_MODE;

  // When in "web" mode, override navigation to use the deploy URL
  const effectiveNavigationUrl =
    browserSource === "web" && deployUrl ? deployUrl : navigationUrl;
  const effectiveUrlInputDraft =
    browserSource === "web" && deployUrl ? deployUrl : urlInputDraft;

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

  const onAddressBarErrorChange = useCallback(
    (pk: string, error: string | null) => {
      setAddressBarErrorByProject((prev) => ({ ...prev, [pk]: error }));
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
    goBack,
    goForward,
    toggleElementGrab,
    reloadCurrentPage,
    nativeWebviewHostRef,
  } = useBrowserWebview({
    projectKey,
    frameVersion,
    navigationUrl: effectiveNavigationUrl,
    currentPageUrl: browserSource === "web" ? deployUrl : currentPageUrl,
    configuredRuntimeUrl: browserSource === "web" ? deployUrl : configuredRuntimeUrl,
    runtimeSurfaceUrl,
    workspaceMode,
    playState,
    filesystemEventVersion,
    onCurrentPageUrlChange,
    onUrlInputDraftChange,
    onAddressBarErrorChange,
    onNavigationUrlChange,
    onFrameVersionIncrement,
    onElementGrabbed,
  });

  // --- Address bar handlers ---

  const updateAddressBarDraft = useCallback(
    (nextAddress: string) => {
      setUrlInputDraftByProject((previous) => ({
        ...previous,
        [projectKey]: nextAddress,
      }));
      setAddressBarErrorByProject((previous) => ({
        ...previous,
        [projectKey]: null,
      }));
    },
    [projectKey]
  );

  const navigateFromAddressBar = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const normalizedUrl = normalizeNavigableUrl(urlInputDraft);
      if (!normalizedUrl) {
        setAddressBarErrorByProject((previous) => ({
          ...previous,
          [projectKey]: "Invalid URL.",
        }));
        return;
      }

      setAddressBarErrorByProject((previous) => ({
        ...previous,
        [projectKey]: null,
      }));
      setNavigationUrlByProject((previous) => ({
        ...previous,
        [projectKey]: normalizedUrl,
      }));
      setCurrentPageUrlByProject((previous) => ({
        ...previous,
        [projectKey]: normalizedUrl,
      }));
      setUrlInputDraftByProject((previous) => ({
        ...previous,
        [projectKey]: normalizedUrl,
      }));
      setFrameVersionByProject((previous) => ({
        ...previous,
        [projectKey]: (previous[projectKey] ?? 0) + 1,
      }));
    },
    [projectKey, urlInputDraft]
  );

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

    if (hasCrossProjectLocalDevMismatch) {
      setAddressBarErrorByProject((previous) => ({
        ...previous,
        [projectKey]: null,
      }));
    }

    if (shouldHydrateNavigationUrl && !!storedNavigationUrl) {
      setFrameVersionByProject((previous) => ({
        ...previous,
        [projectKey]: (previous[projectKey] ?? 0) + 1,
      }));
    }
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
  const showBrowserShell =
    browserTarget.status === "ready" || startupProbeErrorMessage !== null;
  const retryBrowserLoad = () => {
    if (startupProbeErrorMessage) {
      onRestartApp();
      return;
    }
    reloadCurrentPage();
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <BrowserToolbar
        workspaceMode={workspaceMode}
        onWorkspaceModeChange={onWorkspaceModeChange}
        projectId={projectKey}
        urlInputDraft={effectiveUrlInputDraft}
        addressBarError={addressBarError}
        hasBrowserUrl={hasBrowserUrl}
        onAddressBarDraftChange={updateAddressBarDraft}
        onNavigateFromAddressBar={navigateFromAddressBar}
        onGoBack={goBack}
        onGoForward={goForward}
        onReloadCurrentPage={reloadCurrentPage}
        isGrabbing={isGrabbing}
        onToggleElementGrab={toggleElementGrab}
        terminalSessions={terminalSessions}
        activeTerminalId={activeTerminalId}
        onSelectTerminal={onSelectTerminal}
        onCreateTerminal={onCreateTerminal}
        onCreateAgentTerminal={onCreateAgentTerminal}
        onRemoveTerminal={onRemoveTerminal}
        playState={playState}
        onPlay={onPlayProject}
        onStop={onStopProject}
        hasHealthyRuntimeProcess={hasHealthyRuntimeProcess}
        browserSource={browserSource}
        onBrowserSourceChange={setBrowserSource}
        hasDeployUrl={hasDeployUrl}
        onOpenConfigFile={onOpenConfigFile}
      />

      <div className="relative min-h-0 flex-1 bg-background">
        {isEmbeddedBrowserAvailable &&
        (browserTarget.status === "ready" ||
          (browserSource === "web" && deployUrl)) &&
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
        ) : workspaceMode === "skills" ? (
          skillsContent ?? (
            <div className="flex h-full items-center justify-center">
              <p className="font-code text-sm text-muted-foreground/50">
                Project skills
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
        ) : showBrowserShell ? (
          <>
            {(isStartupLoading || isFrameLoading) &&
            !effectiveBrowserErrorMessage ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background px-4">
                <p className="font-code text-xs text-muted-foreground">
                  {isStartupLoading ? "Loading app..." : "Loading page..."}
                </p>
              </div>
            ) : null}

            {effectiveBrowserErrorMessage ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/90 px-4">
                <div className="max-w-md rounded-md border border-border bg-background p-4 text-center">
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
            ) : null}

            {addressBarError ? (
              <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded border border-destructive/50 bg-background/90 px-2 py-1">
                <p className="font-code text-[13px] text-destructive">
                  {addressBarError}
                </p>
              </div>
            ) : null}
          </>
        ) : browserTarget.action === "play" ? (
          <div className="flex h-full items-center justify-center px-4">
            <button
              className="inline-flex items-center rounded border border-border px-3 py-1.5 font-code text-xs text-foreground transition-colors hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={playState === "starting"}
              onClick={onPlayProject}
              type="button"
            >
              {playState === "starting" ? "Starting..." : "|> start"}
            </button>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-xl rounded-md border border-border bg-background p-4 text-center">
              <p
                className={
                  browserTarget.status === "loading"
                    ? "font-code text-xs text-muted-foreground"
                    : "font-code text-xs text-foreground"
                }
              >
                {browserTarget.message}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

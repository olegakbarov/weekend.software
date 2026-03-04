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
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  buildEmbeddedBrowserWebviewLabel,
  createEmbeddedBrowserWebview,
  type EmbeddedBrowserWebviewHandle,
} from "@/lib/embedded-browser-webview";
import { MOCK_MODE } from "@/lib/tauri-mock";
import type {
  PlayState,
  ProjectConfigReadSnapshot,
} from "@/lib/workspace-controller";

function isLocalDevHostname(hostname: string): boolean {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0"
  );
}

function isLocalDevUrl(url: string): boolean {
  try {
    return isLocalDevHostname(new URL(url).hostname);
  } catch {
    return false;
  }
}

function localDevServerMessage(url: string): string {
  try {
    return `Couldn't reach ${new URL(url).host}. Start your dev server in the terminal (for example, pnpm dev), then reload.`;
  } catch {
    return "Couldn't reach this local URL. Start your dev server in the terminal, then reload.";
  }
}

function buildIframeSrc(url: string, frameVersion: number): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "0.0.0.0") {
      parsed.hostname = "localhost";
    }
    const isLocalDevHost = isLocalDevHostname(parsed.hostname);
    if (!isLocalDevHost) return parsed.toString();
    parsed.searchParams.set("__weekend_reload", String(frameVersion));
    return parsed.toString();
  } catch {
    return url;
  }
}

function localDevOriginKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!isLocalDevHostname(parsed.hostname)) return null;
    const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
    return `localhost:${port}`;
  } catch {
    return null;
  }
}

function isCrossProjectLocalDevUrl(
  candidateUrl: string,
  configuredRuntimeUrl: string
): boolean {
  const candidateOrigin = localDevOriginKey(candidateUrl);
  if (!candidateOrigin) return false;
  const configuredOrigin = localDevOriginKey(configuredRuntimeUrl);
  if (!configuredOrigin) return false;
  return candidateOrigin !== configuredOrigin;
}

function buildRuntimeBrowserUrl(
  configSnapshot: ProjectConfigReadSnapshot
): string | null {
  if (!configSnapshot.configValid) {
    return null;
  }

  const runtimeHost = configSnapshot.runtimeHost?.trim() ?? "";
  if (!runtimeHost) return null;

  try {
    const hasScheme =
      runtimeHost.startsWith("http://") || runtimeHost.startsWith("https://");
    const baseUrl = hasScheme ? runtimeHost : `http://${runtimeHost}`;
    const parsed = new URL(baseUrl);

    if (
      configSnapshot.runtimePort != null &&
      Number.isFinite(configSnapshot.runtimePort)
    ) {
      parsed.port = String(configSnapshot.runtimePort);
      parsed.protocol = "http:";
    }
    if (parsed.hostname === "0.0.0.0") {
      parsed.hostname = "localhost";
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

type BrowserRuntimeTarget = {
  status: "ready" | "loading" | "blocked";
  message: string;
  url: string | null;
  action: "play" | null;
};

function resolveBrowserRuntimeTarget({
  selectedProject,
  hasHealthyRuntimeProcess,
  isProjectConfigLoading,
  projectConfigError,
  projectConfigSnapshot,
}: {
  selectedProject: string | null;
  hasHealthyRuntimeProcess: boolean;
  isProjectConfigLoading: boolean;
  projectConfigError: string | null;
  projectConfigSnapshot: ProjectConfigReadSnapshot | null;
}): BrowserRuntimeTarget {
  if (!selectedProject) {
    return {
      status: "blocked",
      message: "Select a project to open the runtime browser.",
      url: null,
      action: null,
    };
  }

  if (projectConfigError) {
    const configPath = projectConfigSnapshot?.configPath;
    return {
      status: "blocked",
      message: configPath
        ? `Failed to read runtime config at ${configPath}: ${projectConfigError}`
        : `Failed to read runtime config for ${selectedProject}: ${projectConfigError}`,
      url: null,
      action: null,
    };
  }

  if (!projectConfigSnapshot) {
    return {
      status: isProjectConfigLoading ? "loading" : "blocked",
      message: isProjectConfigLoading
        ? `Reading runtime config for ${selectedProject}...`
        : `Runtime config is not ready for ${selectedProject}.`,
      url: null,
      action: isProjectConfigLoading ? null : "play",
    };
  }

  if (projectConfigSnapshot.source !== "project-config") {
    if (!projectConfigSnapshot.configExists) {
      return {
        status: "blocked",
        message: `Browser is blocked. Runtime config is missing: ${projectConfigSnapshot.configPath}`,
        url: null,
        action: null,
      };
    }
    const reason =
      projectConfigSnapshot.error ??
      `runtime.port must be set within ${projectConfigSnapshot.portRangeStart}-${projectConfigSnapshot.portRangeEnd}.`;
    return {
      status: "blocked",
      message: `Browser is blocked. Runtime config is invalid at ${projectConfigSnapshot.configPath}: ${reason}`,
      url: null,
      action: null,
    };
  }

  if (!projectConfigSnapshot.configExists) {
    return {
      status: "blocked",
      message: `Browser is blocked. Runtime config is missing: ${projectConfigSnapshot.configPath}`,
      url: null,
      action: null,
    };
  }

  if (!projectConfigSnapshot.configValid) {
    const reason =
      projectConfigSnapshot.error ??
      `runtime.port must be set within ${projectConfigSnapshot.portRangeStart}-${projectConfigSnapshot.portRangeEnd}.`;
    return {
      status: "blocked",
      message: `Browser is blocked. Runtime config is invalid at ${projectConfigSnapshot.configPath}: ${reason}`,
      url: null,
      action: null,
    };
  }

  const runtimeUrl = buildRuntimeBrowserUrl(projectConfigSnapshot);
  if (!runtimeUrl) {
    return {
      status: "blocked",
      message: `Browser is blocked. runtime.host/runtime.port in ${projectConfigSnapshot.configPath} could not be converted to a URL.`,
      url: null,
      action: null,
    };
  }

  if (!hasHealthyRuntimeProcess) {
    return {
      status: "blocked",
      message: "Runtime is not running for this project.",
      url: null,
      action: "play",
    };
  }

  return {
    status: "ready",
    message: runtimeUrl,
    url: runtimeUrl,
    action: null,
  };
}

function normalizeNavigableUrl(rawAddress: string): string | null {
  const trimmed = rawAddress.trim();
  if (!trimmed) return null;
  try {
    const normalizedAddress =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `http://${trimmed}`;
    return new URL(normalizedAddress).toString();
  } catch {
    return null;
  }
}

type WorkspaceMode =
  | "browser"
  | "editor"
  | "agent"
  | "terminal"
  | "settings";

export function BrowserPane({
  projectKey,
  filesystemEventVersion,
  selectedProject,
  hasHealthyRuntimeProcess,
  projectConfigSnapshot,
  isProjectConfigLoading,
  projectConfigError,
  workspaceMode,
  onWorkspaceModeChange,
  onPlayProject,
  playState,
  selectedEditorFilePath,
  editorContent,
  settingsContent,
  agentContent,
  agentTerminalLabel,
  onElementGrabbed,
}: {
  projectKey: string;
  filesystemEventVersion: number;
  selectedProject: string | null;
  hasHealthyRuntimeProcess: boolean;
  projectConfigSnapshot: ProjectConfigReadSnapshot | null;
  isProjectConfigLoading: boolean;
  projectConfigError: string | null;
  workspaceMode: WorkspaceMode;
  onWorkspaceModeChange: (
    mode: "browser" | "editor" | "agent" | "settings"
  ) => void;
  onPlayProject: (project: string) => void;
  playState: PlayState;
  selectedEditorFilePath: string | null;
  editorContent?: ReactNode;
  settingsContent?: ReactNode;
  agentContent?: ReactNode;
  agentTerminalLabel?: string | null;
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
  const frameVersion = frameVersionByProject[projectKey] ?? 0;
  const [isFrameLoading, setIsFrameLoading] = useState(false);
  const [frameErrorMessage, setFrameErrorMessage] = useState<string | null>(
    null
  );
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
  const [isGrabbing, setIsGrabbing] = useState(false);
  const loadTimeoutRef = useRef<number | null>(null);
  const nativeWebviewHostRef = useRef<HTMLDivElement | null>(null);
  const embeddedWebviewRef = useRef<EmbeddedBrowserWebviewHandle | null>(null);
  const lastFilesystemEventVersionByProjectRef = useRef<Record<string, number>>(
    {}
  );

  const browserTarget = useMemo(
    () =>
      resolveBrowserRuntimeTarget({
        selectedProject,
        hasHealthyRuntimeProcess,
        isProjectConfigLoading,
        projectConfigError,
        projectConfigSnapshot,
      }),
    [
      selectedProject,
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
  const selectedEditorFileName =
    selectedEditorFilePath?.split("/").pop() ?? selectedEditorFilePath;

  const runtimeSurfaceUrl = useMemo(
    () => (navigationUrl ? buildIframeSrc(navigationUrl, frameVersion) : null),
    [frameVersion, navigationUrl]
  );

  const clearLoadTimeout = useCallback(() => {
    if (loadTimeoutRef.current === null) return;
    window.clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = null;
  }, []);

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

  const reloadCurrentPage = useCallback(() => {
    const nextUrl = currentPageUrl ?? navigationUrl ?? configuredRuntimeUrl;
    if (!nextUrl) return;
    setNavigationUrlByProject((previous) => ({
      ...previous,
      [projectKey]: nextUrl,
    }));
    setFrameVersionByProject((previous) => ({
      ...previous,
      [projectKey]: (previous[projectKey] ?? 0) + 1,
    }));
    setAddressBarErrorByProject((previous) => ({
      ...previous,
      [projectKey]: null,
    }));
  }, [configuredRuntimeUrl, currentPageUrl, navigationUrl, projectKey]);

  useEffect(() => {
    const previousVersion =
      lastFilesystemEventVersionByProjectRef.current[projectKey];
    lastFilesystemEventVersionByProjectRef.current[projectKey] =
      filesystemEventVersion;

    if (previousVersion === undefined) return;
    if (filesystemEventVersion <= previousVersion) return;

    const nextUrl = currentPageUrl ?? navigationUrl ?? configuredRuntimeUrl;
    if (!nextUrl || !isLocalDevUrl(nextUrl)) {
      return;
    }

    console.info("[Browser] filesystem change detected, reloading webview", {
      projectKey,
      filesystemEventVersion,
      url: nextUrl,
    });

    setNavigationUrlByProject((previous) => ({
      ...previous,
      [projectKey]: nextUrl,
    }));
    setFrameVersionByProject((previous) => ({
      ...previous,
      [projectKey]: (previous[projectKey] ?? 0) + 1,
    }));
    setAddressBarErrorByProject((previous) => ({
      ...previous,
      [projectKey]: null,
    }));
    setFrameErrorMessage(null);
  }, [
    configuredRuntimeUrl,
    currentPageUrl,
    filesystemEventVersion,
    navigationUrl,
    projectKey,
  ]);

  const goBack = useCallback(() => {
    void embeddedWebviewRef.current?.goBack();
  }, []);

  const goForward = useCallback(() => {
    void embeddedWebviewRef.current?.goForward();
  }, []);

  const toggleElementGrab = useCallback(() => {
    const label = embeddedWebviewRef.current?.label;
    if (!label) return;
    const shouldEnable = !isGrabbing;
    setIsGrabbing(shouldEnable);
    void invoke(
      shouldEnable ? "browser_start_element_grab" : "browser_stop_element_grab",
      { label }
    ).catch(() => {
      setIsGrabbing(!shouldEnable);
    });
  }, [isGrabbing]);

  useEffect(() => {
    const unlisten = listen<{
      label: string;
      data: {
        tag: string;
        id: string;
        className: string;
        text: string;
        selector: string;
        outerHTML?: string;
      };
    }>("browser-element-grabbed", (event) => {
      const activeLabel = embeddedWebviewRef.current?.label;
      if (!activeLabel || event.payload.label !== activeLabel) {
        return;
      }
      setIsGrabbing(false);
      onElementGrabbed?.(event.payload.data);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [onElementGrabbed]);

  useEffect(() => {
    if (workspaceMode === "browser" || !isGrabbing) return;
    const label = embeddedWebviewRef.current?.label;
    setIsGrabbing(false);
    if (!label) return;
    void invoke("browser_stop_element_grab", { label }).catch(() => undefined);
  }, [isGrabbing, workspaceMode]);

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
      setFrameErrorMessage(null);
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

  useEffect(() => {
    if (!configuredRuntimeUrl) return;
    setNavigationUrlByProject((previous) => {
      return {
        ...previous,
        [projectKey]: configuredRuntimeUrl,
      };
    });
    setCurrentPageUrlByProject((previous) => {
      return {
        ...previous,
        [projectKey]: configuredRuntimeUrl,
      };
    });
    setUrlInputDraftByProject((previous) => {
      return {
        ...previous,
        [projectKey]: configuredRuntimeUrl,
      };
    });
  }, [configuredRuntimeUrl, projectKey]);

  useEffect(() => {
    if (browserTarget.status !== "ready") return;
    if (!configuredRuntimeUrl) return;
    if (!hasCrossProjectLocalDevMismatch) return;

    console.info("[Browser] restoring configured runtime origin", {
      projectKey,
      configuredRuntimeUrl,
      navigationUrl: storedNavigationUrl,
      currentPageUrl: storedCurrentPageUrl,
      urlInputDraft: storedUrlInputDraft,
    });

    setNavigationUrlByProject((previous) => ({
      ...previous,
      [projectKey]: configuredRuntimeUrl,
    }));
    setCurrentPageUrlByProject((previous) => ({
      ...previous,
      [projectKey]: configuredRuntimeUrl,
    }));
    setUrlInputDraftByProject((previous) => ({
      ...previous,
      [projectKey]: configuredRuntimeUrl,
    }));
    setAddressBarErrorByProject((previous) => ({
      ...previous,
      [projectKey]: null,
    }));
    setFrameErrorMessage(null);
    setFrameVersionByProject((previous) => ({
      ...previous,
      [projectKey]: (previous[projectKey] ?? 0) + 1,
    }));
  }, [
    browserTarget.status,
    configuredRuntimeUrl,
    hasCrossProjectLocalDevMismatch,
    projectKey,
    storedCurrentPageUrl,
    storedNavigationUrl,
    storedUrlInputDraft,
  ]);

  useEffect(() => {
    setAddressBarErrorByProject((previous) => ({
      ...previous,
      [projectKey]: null,
    }));
    setFrameErrorMessage(null);
  }, [projectKey]);

  useEffect(() => {
    clearLoadTimeout();

    if (!navigationUrl) {
      setIsFrameLoading(false);
      setFrameErrorMessage(null);
      return;
    }

    setIsFrameLoading(true);
    setFrameErrorMessage(null);

    if (isLocalDevUrl(navigationUrl)) {
      loadTimeoutRef.current = window.setTimeout(() => {
        console.warn("[Browser] load timeout", {
          projectKey,
          url: navigationUrl,
        });
        setIsFrameLoading(false);
        setFrameErrorMessage(localDevServerMessage(navigationUrl));
      }, 10000);
    }

    return () => {
      clearLoadTimeout();
    };
  }, [clearLoadTimeout, frameVersion, navigationUrl, projectKey]);

  useEffect(() => {
    if (!navigationUrl || !isLocalDevUrl(navigationUrl)) return;
    if (!frameErrorMessage) return;
    if (browserTarget.status !== "ready") return;

    let cancelled = false;
    let probing = false;

    const probeAndRecover = async (): Promise<void> => {
      if (cancelled || probing) return;
      probing = true;
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 1200);
      try {
        await fetch(navigationUrl, {
          method: "GET",
          mode: "no-cors",
          cache: "no-store",
          signal: controller.signal,
        });
        if (cancelled) return;
        console.info("[Browser] runtime reachable, auto-reloading", {
          projectKey,
          url: navigationUrl,
        });
        setFrameErrorMessage(null);
        reloadCurrentPage();
        cancelled = true;
      } catch {
        // keep polling until the local server is reachable
      } finally {
        window.clearTimeout(timeoutId);
        probing = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void probeAndRecover();
    }, 1200);
    void probeAndRecover();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    browserTarget.status,
    frameErrorMessage,
    navigationUrl,
    projectKey,
    reloadCurrentPage,
  ]);

  useEffect(() => {
    if (MOCK_MODE) return;

    let disposed = false;

    const closeExisting = async (): Promise<void> => {
      const existing = embeddedWebviewRef.current;
      if (!existing) return;
      embeddedWebviewRef.current = null;
      await existing.close();
    };

    const mountNativeWebview = async (): Promise<void> => {
      await closeExisting();

      if (!runtimeSurfaceUrl) return;
      const hostElement = nativeWebviewHostRef.current;
      if (!hostElement) return;

      try {
        const webview = await createEmbeddedBrowserWebview({
          container: hostElement,
          label: buildEmbeddedBrowserWebviewLabel(projectKey, frameVersion),
          url: runtimeSurfaceUrl,
          onPageLoad: (payload) => {
            if (payload.phase === "started") {
              setIsFrameLoading(true);
              return;
            }
            clearLoadTimeout();
            console.info("[Browser] native webview page loaded", {
              projectKey,
              url: payload.url,
              webviewLabel: payload.webviewLabel,
            });
            setIsFrameLoading(false);
            setFrameErrorMessage(null);
            setCurrentPageUrlByProject((previous) => ({
              ...previous,
              [projectKey]: payload.url,
            }));
            setUrlInputDraftByProject((previous) => ({
              ...previous,
              [projectKey]: payload.url,
            }));
            setAddressBarErrorByProject((previous) => ({
              ...previous,
              [projectKey]: null,
            }));
          },
        });

        if (disposed) {
          await webview.close();
          return;
        }

        embeddedWebviewRef.current = webview;
        await webview.hide();
      } catch (error) {
        if (disposed) return;
        clearLoadTimeout();
        console.error("[Browser] native webview create failed", {
          projectKey,
          url: runtimeSurfaceUrl,
          error,
        });
        setIsFrameLoading(false);
        setFrameErrorMessage(
          navigationUrl && isLocalDevUrl(navigationUrl)
            ? localDevServerMessage(navigationUrl)
            : "Failed to load the configured runtime endpoint."
        );
      }
    };

    void mountNativeWebview();

    return () => {
      disposed = true;
      void closeExisting();
    };
  }, [
    clearLoadTimeout,
    frameVersion,
    navigationUrl,
    projectKey,
    runtimeSurfaceUrl,
  ]);

  useEffect(() => {
    if (MOCK_MODE) return;
    const webview = embeddedWebviewRef.current;
    if (!webview) return;

    if (workspaceMode !== "browser" || isFrameLoading || frameErrorMessage) {
      void webview.hide();
      return;
    }
    void webview.show();
  }, [frameErrorMessage, isFrameLoading, workspaceMode]);

  const hasBrowserUrl = Boolean(navigationUrl);

  // Handle Cmd/Ctrl+R when focus is in the main Tauri window (toolbar, address
  // bar, etc.). The browser overlay webview is handled separately via injected
  // JS in the Rust on_page_load hook, since overlay keyboard events never
  // bubble to the main window's event listeners.
  useEffect(() => {
    if (workspaceMode !== "browser") return;
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "r") {
        event.preventDefault();
        reloadCurrentPage();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [reloadCurrentPage, workspaceMode]);

  const workspaceModeIndex =
    workspaceMode === "browser"
      ? 0
      : workspaceMode === "agent"
        ? 1
        : workspaceMode === "editor"
          ? 2
          : null;
  const TAB_WIDTH = 92;
  const tabPlateTranslateX =
    workspaceModeIndex === null ? null : workspaceModeIndex * TAB_WIDTH;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="relative flex h-12 shrink-0 items-center gap-2 border-border border-b px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="relative inline-flex h-8 items-stretch rounded-lg bg-muted/35 p-1">
            {tabPlateTranslateX !== null ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-1 left-1 w-[92px] rounded-md border border-border/80 bg-background transition-transform duration-200 ease-out"
                style={{ transform: `translateX(${tabPlateTranslateX}px)` }}
              />
            ) : null}
            <button
              aria-pressed={workspaceMode === "browser"}
              className={
                workspaceMode === "browser"
                  ? "relative z-10 inline-flex h-full w-[92px] items-center justify-center gap-1.5 rounded-md px-2.5 font-medium text-foreground transition-colors"
                  : "relative z-10 inline-flex h-full w-[92px] items-center justify-center gap-1.5 rounded-md px-2.5 text-foreground/70 transition-colors hover:text-foreground/90"
              }
              onClick={() => onWorkspaceModeChange("browser")}
              title="Browser mode"
              type="button"
            >
              <Globe2 className="size-3.5 shrink-0" />
              <span className="font-vcr text-[13px] uppercase tracking-wide">
                Browser
              </span>
            </button>
            <button
              aria-pressed={workspaceMode === "agent"}
              className={
                workspaceMode === "agent"
                  ? "relative z-10 inline-flex h-full w-[92px] items-center justify-center gap-1.5 rounded-md px-2.5 font-medium text-foreground transition-colors"
                  : "relative z-10 inline-flex h-full w-[92px] items-center justify-center gap-1.5 rounded-md px-2.5 text-foreground/70 transition-colors hover:text-foreground/90"
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
                  ? "relative z-10 inline-flex h-full w-[92px] items-center justify-center gap-1.5 rounded-md px-2.5 font-medium text-foreground transition-colors"
                  : "relative z-10 inline-flex h-full w-[92px] items-center justify-center gap-1.5 rounded-md px-2.5 text-foreground/70 transition-colors hover:text-foreground/90"
              }
              onClick={() => onWorkspaceModeChange("editor")}
              title="Editor mode"
              type="button"
            >
              <FileCode2 className="size-3.5 shrink-0" />
              <span className="font-vcr text-[13px] uppercase tracking-wide">
                Editor
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
              onSubmit={navigateFromAddressBar}
            >
              <input
                aria-invalid={addressBarError ? true : undefined}
                className="h-8 min-w-0 flex-1 bg-transparent px-2 font-code text-xs text-foreground outline-none placeholder:text-muted-foreground/60"
                onChange={(event) => updateAddressBarDraft(event.target.value)}
                placeholder="Enter URL and press Enter"
                spellCheck={false}
                value={urlInputDraft}
              />
              <div className="flex shrink-0 items-center gap-0.5 pr-1">
                <button
                  className="rounded p-1 text-muted-foreground/50 transition-colors hover:text-foreground disabled:text-muted-foreground/25"
                  disabled={!hasBrowserUrl}
                  onClick={goBack}
                  title="Back"
                  type="button"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <button
                  className="rounded p-1 text-muted-foreground/50 transition-colors hover:text-foreground disabled:text-muted-foreground/25"
                  disabled={!hasBrowserUrl}
                  onClick={goForward}
                  title="Forward"
                  type="button"
                >
                  <ChevronRight className="size-3.5" />
                </button>
                <button
                  className="rounded p-1 text-muted-foreground/50 transition-colors hover:text-foreground disabled:text-muted-foreground/25"
                  disabled={!hasBrowserUrl}
                  onClick={reloadCurrentPage}
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
              onClick={toggleElementGrab}
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

      <div className="relative min-h-0 flex-1 bg-background">
        {browserTarget.status === "ready" && runtimeSurfaceUrl ? (
          <div
            aria-hidden={workspaceMode !== "browser"}
            className={
              workspaceMode === "browser"
                ? "absolute inset-0"
                : "pointer-events-none absolute inset-0 opacity-0"
            }
          >
            {MOCK_MODE ? (
              <iframe
                className="h-full w-full border-0 bg-background"
                key={`${projectKey}-${runtimeSurfaceUrl}`}
                onError={() => {
                  clearLoadTimeout();
                  console.error("[Browser] iframe onError", {
                    projectKey,
                    url: navigationUrl,
                  });
                  setIsFrameLoading(false);
                  setFrameErrorMessage(
                    navigationUrl && isLocalDevUrl(navigationUrl)
                      ? localDevServerMessage(navigationUrl)
                      : "Failed to load the configured runtime endpoint."
                  );
                }}
                onLoad={() => {
                  clearLoadTimeout();
                  console.info("[Browser] iframe onLoad", {
                    projectKey,
                    url: navigationUrl,
                  });
                  setIsFrameLoading(false);
                  setFrameErrorMessage(null);
                  if (navigationUrl) {
                    setCurrentPageUrlByProject((previous) => ({
                      ...previous,
                      [projectKey]: navigationUrl,
                    }));
                    setUrlInputDraftByProject((previous) => ({
                      ...previous,
                      [projectKey]: navigationUrl,
                    }));
                  }
                }}
                src={runtimeSurfaceUrl}
                title="weekend-browser"
              />
            ) : (
              <div
                className="h-full w-full bg-background"
                ref={nativeWebviewHostRef}
              />
            )}
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
        ) : browserTarget.status === "ready" && runtimeSurfaceUrl ? (
          <>
            {isFrameLoading && !frameErrorMessage ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background px-4">
                <p className="font-code text-xs text-muted-foreground">
                  Loading page...
                </p>
              </div>
            ) : null}

            {frameErrorMessage ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/90 px-4">
                <div className="max-w-md rounded-md border border-border bg-background p-4 text-center">
                  <p className="font-code text-xs text-foreground">
                    {frameErrorMessage}
                  </p>
                  <button
                    className="mt-3 rounded border border-border px-3 py-1.5 font-code text-xs text-muted-foreground transition-colors hover:text-foreground"
                    onClick={reloadCurrentPage}
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
        ) : browserTarget.action === "play" && selectedProject ? (
          <div className="flex h-full items-center justify-center px-4">
            <button
              className="inline-flex items-center rounded border border-border px-3 py-1.5 font-code text-xs text-foreground transition-colors hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={playState === "starting"}
              onClick={() => onPlayProject(selectedProject)}
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

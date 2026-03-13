import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  buildEmbeddedBrowserWebviewLabel,
  closeInactiveEmbeddedBrowserWebviews,
  createEmbeddedBrowserWebview,
  hideInactiveEmbeddedBrowserWebviews,
  type EmbeddedBrowserWebviewHandle,
} from "@/lib/embedded-browser-webview";
import type { PlayState } from "@/lib/controller";
import { planBrowserPaneVisibility } from "@/lib/browser-pane-webviews";
import { MOCK_MODE } from "@/lib/tauri-mock";
import {
  isLocalDevUrl,
  localDevServerMessage,
} from "./browser-url-utils";

export type WebviewState = {
  isFrameLoading: boolean;
  frameErrorMessage: string | null;
  isStartupLoading: boolean;
  startupProbeErrorMessage: string | null;
  displayRuntimeSurfaceUrl: string | null;
};

export type WebviewActions = {
  goBack: () => void;
  goForward: () => void;
  toggleElementGrab: () => void;
  reloadCurrentPage: () => void;
  isGrabbing: boolean;
};

type BrowserRuntimeProbeResult = {
  ready: boolean;
  statusCode: number | null;
  error: string | null;
};

const STARTUP_RUNTIME_PROBE_INTERVAL_MS = 700;
const STARTUP_RUNTIME_PROBE_TIMEOUT_MS = 15000;

function buildStartupProbeErrorMessage(
  url: string,
  statusCode: number | null,
  error: string | null
): string {
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();

  if (typeof statusCode === "number") {
    return `Waiting for ${host} to finish starting timed out (HTTP ${statusCode}). Check the project terminal, then retry.`;
  }

  const detail = error?.trim();
  if (detail) {
    return `Waiting for ${host} to finish starting timed out. ${detail}`;
  }

  return localDevServerMessage(url);
}

export function useBrowserWebview({
  projectKey,
  frameVersion,
  navigationUrl,
  currentPageUrl,
  configuredRuntimeUrl,
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
}: {
  projectKey: string;
  frameVersion: number;
  navigationUrl: string | null;
  currentPageUrl: string | null;
  configuredRuntimeUrl: string | null;
  runtimeSurfaceUrl: string | null;
  workspaceMode: string;
  playState: PlayState;
  filesystemEventVersion: number;
  onCurrentPageUrlChange: (projectKey: string, url: string) => void;
  onUrlInputDraftChange: (projectKey: string, url: string) => void;
  onAddressBarErrorChange: (projectKey: string, error: string | null) => void;
  onNavigationUrlChange: (projectKey: string, url: string) => void;
  onFrameVersionIncrement: (projectKey: string) => void;
  onElementGrabbed?: (data: {
    tag: string;
    id: string;
    className: string;
    text: string;
    selector: string;
    outerHTML?: string;
  }) => void;
}): WebviewState & WebviewActions & {
  nativeWebviewHostRef: React.RefObject<HTMLDivElement | null>;
} {
  const [isFrameLoading, setIsFrameLoading] = useState(false);
  const [frameErrorMessage, setFrameErrorMessage] = useState<string | null>(
    null
  );
  const [isAwaitingStartupRuntime, setIsAwaitingStartupRuntime] = useState(
    false
  );
  const [startupProbeErrorMessage, setStartupProbeErrorMessage] = useState<
    string | null
  >(null);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const loadTimeoutRef = useRef<number | null>(null);
  const nativeWebviewHostRef = useRef<HTMLDivElement | null>(null);
  const embeddedWebviewRef = useRef<EmbeddedBrowserWebviewHandle | null>(null);
  const lastFilesystemEventVersionByProjectRef = useRef<Record<string, number>>(
    {}
  );
  const shouldUseStartupRuntimeProbe =
    !MOCK_MODE &&
    !!configuredRuntimeUrl &&
    isLocalDevUrl(configuredRuntimeUrl);
  const isStartupLoading =
    (playState === "starting" && shouldUseStartupRuntimeProbe) ||
    isAwaitingStartupRuntime;
  const displayRuntimeSurfaceUrl =
    MOCK_MODE || isStartupLoading || startupProbeErrorMessage
      ? null
      : runtimeSurfaceUrl;

  const clearLoadTimeout = useCallback(() => {
    if (loadTimeoutRef.current === null) return;
    window.clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = null;
  }, []);

  useEffect(() => {
    setIsAwaitingStartupRuntime(false);
    setStartupProbeErrorMessage(null);
  }, [configuredRuntimeUrl, projectKey]);

  useEffect(() => {
    if (!shouldUseStartupRuntimeProbe) {
      setIsAwaitingStartupRuntime(false);
      setStartupProbeErrorMessage(null);
      return;
    }

    if (playState === "starting") {
      setIsAwaitingStartupRuntime(true);
      setStartupProbeErrorMessage(null);
      setFrameErrorMessage(null);
      onAddressBarErrorChange(projectKey, null);
      return;
    }

    if (playState === "idle") {
      setIsAwaitingStartupRuntime(false);
      setStartupProbeErrorMessage(null);
      return;
    }

    if (playState === "failed") {
      setIsAwaitingStartupRuntime(false);
    }
  }, [
    onAddressBarErrorChange,
    playState,
    projectKey,
    shouldUseStartupRuntimeProbe,
  ]);

  useEffect(() => {
    if (!shouldUseStartupRuntimeProbe) return;
    if (!configuredRuntimeUrl) return;
    if (!isAwaitingStartupRuntime) return;

    let cancelled = false;
    let probeInFlight = false;
    const startedAt = Date.now();

    const probeRuntime = async (): Promise<void> => {
      if (cancelled || probeInFlight) return;
      probeInFlight = true;

      try {
        const result = await invoke<BrowserRuntimeProbeResult>(
          "browser_probe_runtime_url",
          {
            url: configuredRuntimeUrl,
          }
        );
        if (cancelled) return;

        if (result.ready) {
          setIsAwaitingStartupRuntime(false);
          setStartupProbeErrorMessage(null);
          return;
        }

        if (Date.now() - startedAt >= STARTUP_RUNTIME_PROBE_TIMEOUT_MS) {
          setIsAwaitingStartupRuntime(false);
          setStartupProbeErrorMessage(
            buildStartupProbeErrorMessage(
              configuredRuntimeUrl,
              result.statusCode,
              result.error
            )
          );
        }
      } catch (error) {
        if (cancelled) return;

        if (Date.now() - startedAt >= STARTUP_RUNTIME_PROBE_TIMEOUT_MS) {
          setIsAwaitingStartupRuntime(false);
          setStartupProbeErrorMessage(
            buildStartupProbeErrorMessage(
              configuredRuntimeUrl,
              null,
              error instanceof Error ? error.message : String(error)
            )
          );
        }
      } finally {
        probeInFlight = false;
      }
    };

    void probeRuntime();
    const intervalId = window.setInterval(() => {
      void probeRuntime();
    }, STARTUP_RUNTIME_PROBE_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    configuredRuntimeUrl,
    isAwaitingStartupRuntime,
    shouldUseStartupRuntimeProbe,
  ]);

  const reloadCurrentPage = useCallback(() => {
    const nextUrl = currentPageUrl ?? navigationUrl ?? configuredRuntimeUrl;
    if (!nextUrl) return;
    onNavigationUrlChange(projectKey, nextUrl);
    onFrameVersionIncrement(projectKey);
    onAddressBarErrorChange(projectKey, null);
  }, [
    configuredRuntimeUrl,
    currentPageUrl,
    navigationUrl,
    onAddressBarErrorChange,
    onFrameVersionIncrement,
    onNavigationUrlChange,
    projectKey,
  ]);

  // Filesystem change auto-reload
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

    onNavigationUrlChange(projectKey, nextUrl);
    onFrameVersionIncrement(projectKey);
    onAddressBarErrorChange(projectKey, null);
    setFrameErrorMessage(null);
  }, [
    configuredRuntimeUrl,
    currentPageUrl,
    filesystemEventVersion,
    navigationUrl,
    onAddressBarErrorChange,
    onFrameVersionIncrement,
    onNavigationUrlChange,
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

  // Listen for element-grabbed events
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

  // Cancel grab when leaving browser mode
  useEffect(() => {
    if (workspaceMode === "browser" || !isGrabbing) return;
    const label = embeddedWebviewRef.current?.label;
    setIsGrabbing(false);
    if (!label) return;
    void invoke("browser_stop_element_grab", { label }).catch(() => undefined);
  }, [isGrabbing, workspaceMode]);

  // Load timeout
  useEffect(() => {
    clearLoadTimeout();

    if (!displayRuntimeSurfaceUrl || !navigationUrl) {
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
  }, [
    clearLoadTimeout,
    displayRuntimeSurfaceUrl,
    frameVersion,
    navigationUrl,
    projectKey,
  ]);

  // Probe and auto-recover when frame error is shown
  useEffect(() => {
    if (!navigationUrl || !isLocalDevUrl(navigationUrl)) return;
    if (!frameErrorMessage) return;

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
    frameErrorMessage,
    navigationUrl,
    projectKey,
    reloadCurrentPage,
  ]);

  // Native webview mount/unmount lifecycle
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

      if (!displayRuntimeSurfaceUrl) return;
      const hostElement = nativeWebviewHostRef.current;
      if (!hostElement) return;

      try {
        const nextLabel = buildEmbeddedBrowserWebviewLabel(
          projectKey,
          frameVersion
        );
        const webview = await createEmbeddedBrowserWebview({
          container: hostElement,
          label: nextLabel,
          url: displayRuntimeSurfaceUrl,
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
            onCurrentPageUrlChange(projectKey, payload.url);
            onUrlInputDraftChange(projectKey, payload.url);
            onAddressBarErrorChange(projectKey, null);
          },
        });

        if (disposed) {
          await webview.close();
          return;
        }

        await closeInactiveEmbeddedBrowserWebviews(nextLabel);
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
          url: displayRuntimeSurfaceUrl,
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
    onAddressBarErrorChange,
    onCurrentPageUrlChange,
    onUrlInputDraftChange,
    projectKey,
    displayRuntimeSurfaceUrl,
  ]);

  // Show/hide webview based on mode and loading state
  useEffect(() => {
    if (MOCK_MODE) return;
    let cancelled = false;

    const syncBrowserVisibility = async (): Promise<void> => {
      const activeWebview = embeddedWebviewRef.current;
      const visibilityPlan = planBrowserPaneVisibility({
        activeLabel: activeWebview?.label ?? null,
        shouldShowActivePane:
          workspaceMode === "browser" && !isFrameLoading && !frameErrorMessage,
      });

      if (!visibilityPlan.showActivePaneViaHandle) {
        if (visibilityPlan.hideActivePaneViaHandle) {
          await activeWebview?.hide();
        }
        await hideInactiveEmbeddedBrowserWebviews(
          visibilityPlan.inactivePaneExclusionLabel
        );
        return;
      }

      await hideInactiveEmbeddedBrowserWebviews(
        visibilityPlan.inactivePaneExclusionLabel
      );
      if (cancelled) return;
      await embeddedWebviewRef.current?.show();
    };

    void syncBrowserVisibility();

    return () => {
      cancelled = true;
    };
  }, [
    displayRuntimeSurfaceUrl,
    frameErrorMessage,
    frameVersion,
    isFrameLoading,
    projectKey,
    workspaceMode,
  ]);

  // Handle Cmd/Ctrl+R when focus is in the main Tauri window
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

  // Clear errors on project switch
  useEffect(() => {
    onAddressBarErrorChange(projectKey, null);
    setFrameErrorMessage(null);
  }, [onAddressBarErrorChange, projectKey]);

  return {
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
  };
}

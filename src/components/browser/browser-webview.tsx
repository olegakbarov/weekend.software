import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  buildEmbeddedBrowserWebviewLabel,
  BROWSER_WEBVIEW_ROUTE_CHANGE_EVENT,
  closeInactiveEmbeddedBrowserWebviews,
  createEmbeddedBrowserWebview,
  type BrowserWebviewRouteChangePayload,
  type BrowserWebviewPageLoadPayload,
  type EmbeddedBrowserWebviewHandle,
} from "@/lib/embedded-browser-webview";
import type { PlayState } from "@/lib/controller";
import { planBrowserPaneVisibility } from "@/lib/browser-pane-webviews";
import {
  activateManagedBrowserWebview,
  buildManagedBrowserWebviewCacheKey,
  claimBrowserWebviewStartupCleanup,
  clearManagedBrowserWebviewPageLoadHandler,
  closeSupersededManagedBrowserWebviews,
  hasManagedBrowserWebview,
  hideManagedBrowserWebviewsExcept,
  showManagedBrowserWebview,
  updateManagedBrowserWebviewLastUrl,
  updateManagedBrowserWebviewReadyState,
} from "@/lib/browser-webview-manager";
import {
  notifyPreviewCaptured,
  registerPreviewCapturer,
  saveProjectPreview,
} from "@/lib/project-preview";
import { MOCK_MODE } from "@/lib/tauri-mock";
import { isLocalDevUrl, localDevServerMessage } from "./browser-url-utils";
import {
  isBrowserRuntimeUrlReady,
  probeBrowserRuntimeReadiness,
  type BrowserRuntimeProbeResult,
} from "./browser-runtime-probe";

export type WebviewState = {
  isFrameLoading: boolean;
  frameErrorMessage: string | null;
  isStartupLoading: boolean;
  startupProbeErrorMessage: string | null;
  displayRuntimeSurfaceUrl: string | null;
};

export type CapturePreviewResult =
  | { ok: true; dataUrl: string }
  | { ok: false; reason: string };

export type WebviewActions = {
  goBack: () => void;
  goForward: () => void;
  toggleElementGrab: () => void;
  reloadCurrentPage: () => void;
  isGrabbing: boolean;
  capturePreview: () => Promise<CapturePreviewResult>;
};

const PREVIEW_MAX_WIDTH = 1024;

async function downscalePngDataUrl(
  dataUrl: string,
  maxWidth: number,
): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("preview image failed to decode"));
    img.src = dataUrl;
  });
  if (img.width <= maxWidth) return dataUrl;
  const scale = maxWidth / img.width;
  const canvas = document.createElement("canvas");
  canvas.width = maxWidth;
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

function toErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return String(error);
}

const STARTUP_RUNTIME_PROBE_INTERVAL_MS = 700;
const STARTUP_RUNTIME_PROBE_TIMEOUT_MS = 15000;

function buildStartupProbeErrorMessage(
  url: string,
  statusCode: number | null,
  error: string | null,
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
  isBrowserPaneVisible,
  shouldKeepPreviousSurfaceWhenUnavailable,
  playState,
  filesystemEventVersion,
  onCurrentPageUrlChange,
  onUrlInputDraftChange,
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
  isBrowserPaneVisible: boolean;
  shouldKeepPreviousSurfaceWhenUnavailable: boolean;
  playState: PlayState;
  filesystemEventVersion: number;
  onCurrentPageUrlChange: (projectKey: string, url: string) => void;
  onUrlInputDraftChange: (projectKey: string, url: string) => void;
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
}): WebviewState &
  WebviewActions & {
    nativeWebviewHostRef: React.RefObject<HTMLDivElement | null>;
  } {
  const [isFrameLoading, setIsFrameLoading] = useState(false);
  const [frameErrorMessage, setFrameErrorMessage] = useState<string | null>(
    null,
  );
  const [isAwaitingStartupRuntime, setIsAwaitingStartupRuntime] =
    useState(false);
  const [startupProbeErrorMessage, setStartupProbeErrorMessage] = useState<
    string | null
  >(null);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [activeWebviewRevision, setActiveWebviewRevision] = useState(0);
  const loadTimeoutRef = useRef<number | null>(null);
  const runtimeReloadTimeoutRef = useRef<number | null>(null);
  const nativeWebviewHostRef = useRef<HTMLDivElement | null>(null);
  const activeWebviewRef = useRef<EmbeddedBrowserWebviewHandle | null>(null);
  const activationSequenceRef = useRef(0);
  const lastFilesystemEventVersionByProjectRef = useRef<Record<string, number>>(
    {},
  );
  const shouldUseStartupRuntimeProbe =
    !MOCK_MODE && !!configuredRuntimeUrl && isLocalDevUrl(configuredRuntimeUrl);
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

  const clearRuntimeReloadTimeout = useCallback(() => {
    if (runtimeReloadTimeoutRef.current === null) return;
    window.clearTimeout(runtimeReloadTimeoutRef.current);
    runtimeReloadTimeoutRef.current = null;
  }, []);

  // Route params can change before passive effects run; clear stale browser
  // status before paint so the previous project never flashes on the next one.
  useLayoutEffect(() => {
    clearLoadTimeout();
    clearRuntimeReloadTimeout();
    setIsFrameLoading(false);
    setFrameErrorMessage(null);
    setIsAwaitingStartupRuntime(false);
    setStartupProbeErrorMessage(null);
  }, [
    clearLoadTimeout,
    clearRuntimeReloadTimeout,
    configuredRuntimeUrl,
    projectKey,
  ]);

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
  }, [playState, projectKey, shouldUseStartupRuntimeProbe]);

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
        const result = await probeBrowserRuntimeReadiness(configuredRuntimeUrl);
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
              result.error,
            ),
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
              error instanceof Error ? error.message : String(error),
            ),
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
  }, [
    configuredRuntimeUrl,
    currentPageUrl,
    navigationUrl,
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
    setFrameErrorMessage(null);
  }, [
    configuredRuntimeUrl,
    currentPageUrl,
    filesystemEventVersion,
    navigationUrl,
    onFrameVersionIncrement,
    onNavigationUrlChange,
    projectKey,
  ]);

  const goBack = useCallback(() => {
    void activeWebviewRef.current?.goBack();
  }, []);

  const goForward = useCallback(() => {
    void activeWebviewRef.current?.goForward();
  }, []);

  const toggleElementGrab = useCallback(() => {
    const label = activeWebviewRef.current?.label;
    if (!label) return;
    const shouldEnable = !isGrabbing;
    setIsGrabbing(shouldEnable);
    void invoke(
      shouldEnable ? "browser_start_element_grab" : "browser_stop_element_grab",
      { label },
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
      const activeLabel = activeWebviewRef.current?.label;
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
    const unlisten = listen<BrowserWebviewRouteChangePayload>(
      BROWSER_WEBVIEW_ROUTE_CHANGE_EVENT,
      (event) => {
        const expectedLabel = buildEmbeddedBrowserWebviewLabel(
          projectKey,
          frameVersion,
        );
        if (event.payload.webviewLabel !== expectedLabel) return;

        const nextUrl = event.payload.url.trim();
        if (!nextUrl) return;

        updateManagedBrowserWebviewLastUrl(
          buildManagedBrowserWebviewCacheKey(projectKey, frameVersion),
          nextUrl,
        );
        onCurrentPageUrlChange(projectKey, nextUrl);
        onUrlInputDraftChange(projectKey, nextUrl);
      },
    );

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [frameVersion, onCurrentPageUrlChange, onUrlInputDraftChange, projectKey]);

  // Cancel grab when the browser surface is no longer visible.
  useEffect(() => {
    if (isBrowserPaneVisible || !isGrabbing) return;
    const label = activeWebviewRef.current?.label;
    setIsGrabbing(false);
    if (!label) return;
    void invoke("browser_stop_element_grab", { label }).catch(() => undefined);
  }, [isBrowserPaneVisible, isGrabbing]);

  // Load timeout
  useEffect(() => {
    clearLoadTimeout();

    if (!displayRuntimeSurfaceUrl || !navigationUrl) {
      setIsFrameLoading(false);
      setFrameErrorMessage(null);
      return;
    }

    if (!isFrameLoading) {
      return;
    }

    if (isLocalDevUrl(navigationUrl)) {
      loadTimeoutRef.current = window.setTimeout(() => {
        console.warn("[Browser] load timeout", {
          projectKey,
          url: navigationUrl,
        });
        clearRuntimeReloadTimeout();
        setIsFrameLoading(false);
        setFrameErrorMessage(localDevServerMessage(navigationUrl));
      }, 10000);
    }

    return () => {
      clearLoadTimeout();
    };
  }, [
    clearLoadTimeout,
    clearRuntimeReloadTimeout,
    displayRuntimeSurfaceUrl,
    frameVersion,
    isFrameLoading,
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
  }, [frameErrorMessage, navigationUrl, projectKey, reloadCurrentPage]);

  // One-shot orphan cleanup per renderer lifetime. This must not run on every
  // BrowserPane mount because the native webview cache intentionally survives
  // route churn.
  useEffect(() => {
    if (MOCK_MODE) return;
    if (!claimBrowserWebviewStartupCleanup()) return;
    void closeInactiveEmbeddedBrowserWebviews(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On unmount, detach the current page-load callback. The managed native
  // webview cache stays alive so returning to a running project can be instant.
  useEffect(() => {
    if (MOCK_MODE) return;
    return () => {
      activationSequenceRef.current += 1;
      activeWebviewRef.current = null;
      clearRuntimeReloadTimeout();
    };
  }, [clearRuntimeReloadTimeout]);

  // Attach/detach the active webview, creating it lazily. The cache is managed
  // outside this hook so it can survive project-route remounts.
  useEffect(() => {
    if (MOCK_MODE) return;

    let disposed = false;
    const activationId = activationSequenceRef.current + 1;
    activationSequenceRef.current = activationId;
    const cacheKey = buildManagedBrowserWebviewCacheKey(
      projectKey,
      frameVersion,
    );

    const handlePageLoad = (payload: BrowserWebviewPageLoadPayload): void => {
      if (activationId !== activationSequenceRef.current) return;
      if (payload.phase === "started") {
        clearRuntimeReloadTimeout();
        updateManagedBrowserWebviewReadyState(cacheKey, false);
        setIsFrameLoading(true);
        return;
      }

      void (async () => {
        updateManagedBrowserWebviewLastUrl(cacheKey, payload.url);
        onCurrentPageUrlChange(projectKey, payload.url);
        onUrlInputDraftChange(projectKey, payload.url);

        const isReady = await isBrowserRuntimeUrlReady(payload.url);
        if (activationId !== activationSequenceRef.current) return;

        if (!isReady) {
          updateManagedBrowserWebviewReadyState(cacheKey, false);
          setIsFrameLoading(true);
          setFrameErrorMessage(null);
          if (runtimeReloadTimeoutRef.current === null) {
            runtimeReloadTimeoutRef.current = window.setTimeout(() => {
              runtimeReloadTimeoutRef.current = null;
              if (activationId !== activationSequenceRef.current) return;
              void activeWebviewRef.current?.navigate(payload.url);
            }, STARTUP_RUNTIME_PROBE_INTERVAL_MS);
          }
          return;
        }

        clearRuntimeReloadTimeout();
        clearLoadTimeout();
        console.info("[Browser] native webview page loaded", {
          projectKey,
          url: payload.url,
          webviewLabel: payload.webviewLabel,
        });
        setIsFrameLoading(false);
        setFrameErrorMessage(null);
        updateManagedBrowserWebviewReadyState(cacheKey, true);
      })();
    };

    const attach = async (): Promise<void> => {
      const hostElement = nativeWebviewHostRef.current;
      if (!displayRuntimeSurfaceUrl || !isBrowserPaneVisible) {
        activeWebviewRef.current = null;
        setIsFrameLoading(false);
        setFrameErrorMessage(null);
        if (
          !isBrowserPaneVisible ||
          !shouldKeepPreviousSurfaceWhenUnavailable
        ) {
          await hideManagedBrowserWebviewsExcept(null);
        }
        return;
      }
      if (!hostElement) {
        activeWebviewRef.current = null;
        return;
      }

      const hasCachedEntry = hasManagedBrowserWebview(cacheKey);
      if (!hasCachedEntry) {
        setIsFrameLoading(true);
        setFrameErrorMessage(null);
      }

      try {
        const nextLabel = buildEmbeddedBrowserWebviewLabel(
          projectKey,
          frameVersion,
        );
        const activation = await activateManagedBrowserWebview({
          cacheKey,
          container: hostElement,
          createHandle: () =>
            createEmbeddedBrowserWebview({
              container: hostElement,
              label: nextLabel,
              url: displayRuntimeSurfaceUrl,
              onPageLoad: handlePageLoad,
            }),
          frameVersion,
          isCurrent: () =>
            !disposed && activationId === activationSequenceRef.current,
          onPageLoad: handlePageLoad,
          projectKey,
          url: displayRuntimeSurfaceUrl,
        });

        if (disposed || activationId !== activationSequenceRef.current) {
          return;
        }

        activeWebviewRef.current = activation.entry.handle;
        setActiveWebviewRevision((previous) => previous + 1);
        const isLoadingAfterActivation =
          activation.created || activation.navigated;
        if (isLoadingAfterActivation) {
          setIsFrameLoading(true);
          setFrameErrorMessage(null);
        } else {
          clearLoadTimeout();
          setIsFrameLoading(false);
          setFrameErrorMessage(null);
        }
      } catch (error) {
        if (disposed || activationId !== activationSequenceRef.current) return;
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
            : "Failed to load the configured runtime endpoint.",
        );
      }
    };

    void attach();

    return () => {
      disposed = true;
      clearRuntimeReloadTimeout();
      clearManagedBrowserWebviewPageLoadHandler(cacheKey);
    };
  }, [
    clearLoadTimeout,
    clearRuntimeReloadTimeout,
    frameVersion,
    navigationUrl,
    onCurrentPageUrlChange,
    onUrlInputDraftChange,
    isBrowserPaneVisible,
    projectKey,
    shouldKeepPreviousSurfaceWhenUnavailable,
    displayRuntimeSurfaceUrl,
  ]);

  // Show/hide webview based on mode and loading state
  useEffect(() => {
    if (MOCK_MODE) return;
    let cancelled = false;

    const syncBrowserVisibility = async (): Promise<void> => {
      const activeWebview = activeWebviewRef.current;
      if (displayRuntimeSurfaceUrl && isBrowserPaneVisible && !activeWebview) {
        return;
      }
      const expectedLabel = buildEmbeddedBrowserWebviewLabel(
        projectKey,
        frameVersion,
      );
      const activeCacheKey =
        activeWebview?.label === expectedLabel
          ? buildManagedBrowserWebviewCacheKey(projectKey, frameVersion)
          : null;
      const visibilityPlan = planBrowserPaneVisibility({
        activeLabel: activeWebview?.label ?? null,
        shouldShowActivePane:
          isBrowserPaneVisible && !isFrameLoading && !frameErrorMessage,
      });

      if (!visibilityPlan.showActivePaneViaHandle) {
        if (visibilityPlan.hideActivePaneViaHandle) {
          await activeWebview?.hide();
        }
        if (isBrowserPaneVisible && isFrameLoading && !frameErrorMessage) {
          return;
        }
        await hideManagedBrowserWebviewsExcept(activeCacheKey);
        return;
      }

      await showManagedBrowserWebview(activeCacheKey!);
      if (cancelled) return;
      await hideManagedBrowserWebviewsExcept(activeCacheKey);
      if (cancelled) return;
      await closeSupersededManagedBrowserWebviews(projectKey, activeCacheKey!);
    };

    void syncBrowserVisibility();

    return () => {
      cancelled = true;
    };
  }, [
    activeWebviewRevision,
    displayRuntimeSurfaceUrl,
    frameErrorMessage,
    frameVersion,
    isBrowserPaneVisible,
    isFrameLoading,
    projectKey,
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

  const capturePreview =
    useCallback(async (): Promise<CapturePreviewResult> => {
      const handle = activeWebviewRef.current;
      if (!handle) {
        return { ok: false, reason: "webview not mounted" };
      }
      let rawDataUrl: string | null;
      try {
        rawDataUrl = await handle.captureScreenshot();
      } catch (error) {
        return { ok: false, reason: `capture: ${toErrorMessage(error)}` };
      }
      if (!rawDataUrl) {
        return { ok: false, reason: "capture returned empty" };
      }
      let dataUrl: string;
      try {
        dataUrl = await downscalePngDataUrl(rawDataUrl, PREVIEW_MAX_WIDTH);
      } catch (error) {
        return { ok: false, reason: `downscale: ${toErrorMessage(error)}` };
      }
      try {
        await saveProjectPreview(projectKey, dataUrl);
      } catch (error) {
        return { ok: false, reason: `save: ${toErrorMessage(error)}` };
      }
      notifyPreviewCaptured(projectKey, dataUrl);
      return { ok: true, dataUrl };
    }, [projectKey]);

  useEffect(() => {
    return registerPreviewCapturer(projectKey, async () => {
      await capturePreview();
    });
  }, [capturePreview, projectKey]);

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
    capturePreview,
    nativeWebviewHostRef,
  };
}

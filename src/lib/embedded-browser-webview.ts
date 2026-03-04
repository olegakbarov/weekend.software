import { invoke } from "@tauri-apps/api/core";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Webview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const BROWSER_WEBVIEW_PAGE_LOAD_EVENT = "browser-webview-page-load";

export type BrowserWebviewPageLoadPayload = {
  webviewLabel: string;
  windowLabel: string;
  url: string;
  phase: "started" | "finished";
};

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type EmbeddedBrowserWebviewHandle = {
  label: string;
  hide: () => Promise<void>;
  show: () => Promise<void>;
  close: () => Promise<void>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
};

export function buildEmbeddedBrowserWebviewLabel(
  projectKey: string,
  frameVersion: number
): string {
  const normalizedProjectKey =
    projectKey
      .trim()
      .replace(/[^a-zA-Z0-9\-/:_]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 64) || "project";
  return `browser-pane:${normalizedProjectKey}:${frameVersion}`;
}

function readContainerBounds(container: HTMLElement): Bounds | null {
  const rect = container.getBoundingClientRect();
  if (
    !Number.isFinite(rect.left) ||
    !Number.isFinite(rect.top) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height)
  ) {
    return null;
  }
  // Native webview bounds are pixel-aligned. During animated/fractional layout
  // changes, round() can undershoot by 1px and expose a right-edge gap.
  // floor(position) + ceil(size) guarantees the webview fully covers the host.
  return {
    x: Math.floor(rect.left),
    y: Math.floor(rect.top),
    width: Math.max(1, Math.ceil(rect.width)),
    height: Math.max(1, Math.ceil(rect.height)),
  };
}

function boundsChanged(previous: Bounds | null, next: Bounds): boolean {
  if (!previous) return true;
  return (
    previous.x !== next.x ||
    previous.y !== next.y ||
    previous.width !== next.width ||
    previous.height !== next.height
  );
}

function stringifyEventPayload(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (payload instanceof Error) return payload.message;
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

async function waitForWebviewCreation(webview: Webview): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Timed out while creating embedded browser webview."));
    }, 5000);

    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      fn();
    };

    void webview.once("tauri://created", () => {
      settle(resolve);
    });
    void webview.once("tauri://error", (event) => {
      settle(() => {
        reject(
          new Error(
            stringifyEventPayload(event.payload) ||
              "Failed to create embedded browser webview."
          )
        );
      });
    });
  });
}

export async function createEmbeddedBrowserWebview({
  container,
  label,
  url,
  onPageLoad,
}: {
  container: HTMLElement;
  label: string;
  url: string;
  onPageLoad?: (payload: BrowserWebviewPageLoadPayload) => void;
}): Promise<EmbeddedBrowserWebviewHandle> {
  let unlistenPageLoad: UnlistenFn | null = null;
  if (onPageLoad) {
    unlistenPageLoad = await listen<BrowserWebviewPageLoadPayload>(
      BROWSER_WEBVIEW_PAGE_LOAD_EVENT,
      (event) => {
        if (event.payload.webviewLabel !== label) return;
        onPageLoad(event.payload);
      }
    );
  }

  const existing = await Webview.getByLabel(label);
  if (existing) {
    await existing.close().catch(() => undefined);
  }

  const initialBounds = readContainerBounds(container) ?? {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  };

  const webview = new Webview(getCurrentWindow(), label, {
    url,
    x: initialBounds.x,
    y: initialBounds.y,
    width: initialBounds.width,
    height: initialBounds.height,
    focus: false,
  });

  try {
    await waitForWebviewCreation(webview);
  } catch (error) {
    if (unlistenPageLoad) {
      unlistenPageLoad();
      unlistenPageLoad = null;
    }
    await webview.close().catch(() => undefined);
    throw error;
  }

  let closed = false;
  let visible = true;
  let animationFrameId: number | null = null;
  let syncInFlight = false;
  let syncQueued = false;
  let previousBounds: Bounds | null = null;

  const syncBounds = async (): Promise<void> => {
    if (closed) return;
    if (syncInFlight) {
      syncQueued = true;
      return;
    }

    syncInFlight = true;
    try {
      do {
        syncQueued = false;
        const nextBounds = readContainerBounds(container);
        if (!nextBounds || !boundsChanged(previousBounds, nextBounds)) {
          continue;
        }

        await Promise.all([
          webview.setPosition(new LogicalPosition(nextBounds.x, nextBounds.y)),
          webview.setSize(new LogicalSize(nextBounds.width, nextBounds.height)),
        ]);
        previousBounds = nextBounds;
      } while (!closed && syncQueued);
    } catch (error) {
      if (!closed) {
        console.warn("[Browser] native webview bounds sync failed", {
          label,
          error,
        });
      }
    } finally {
      syncInFlight = false;
    }
  };

  const tick = (): void => {
    if (closed) return;
    void syncBounds();
    animationFrameId = window.requestAnimationFrame(tick);
  };
  tick();

  const setVisible = async (nextVisible: boolean): Promise<void> => {
    if (closed || visible === nextVisible) return;
    try {
      if (nextVisible) {
        await webview.show();
      } else {
        await webview.hide();
      }
      visible = nextVisible;
    } catch (error) {
      if (!closed) {
        console.warn("[Browser] native webview visibility change failed", {
          label,
          error,
        });
      }
    }
  };

  const historyNavigate = async (direction: "back" | "forward"): Promise<void> => {
    if (closed) return;
    await invoke("browser_history_navigate", { label, direction }).catch(() => undefined);
  };

  return {
    label,
    hide: async () => {
      await setVisible(false);
    },
    show: async () => {
      await setVisible(true);
    },
    close: async () => {
      if (closed) return;
      closed = true;
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      if (unlistenPageLoad) {
        unlistenPageLoad();
        unlistenPageLoad = null;
      }
      await webview.close().catch(() => undefined);
    },
    goBack: () => historyNavigate("back"),
    goForward: () => historyNavigate("forward"),
  };
}

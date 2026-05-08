import { insertBrowserWebviewCacheEntry } from "./browser-pane-webviews.ts";
import type { BrowserWebviewPageLoadPayload } from "./embedded-browser-webview.ts";

export type BrowserWebviewPageLoadHandler = (
  payload: BrowserWebviewPageLoadPayload
) => void;

export type ManagedBrowserWebviewHandle = {
  label: string;
  attach: (container: HTMLElement) => Promise<void> | void;
  close: () => Promise<void>;
  hide: () => Promise<void>;
  navigate: (url: string) => Promise<void>;
  setPageLoadHandler: (
    handler: BrowserWebviewPageLoadHandler | null
  ) => void;
  show: () => Promise<void>;
};

export type ManagedBrowserWebviewEntry = {
  cacheKey: string;
  frameVersion: number;
  handle: ManagedBrowserWebviewHandle;
  lastUrl: string;
  projectKey: string;
};

export type ManagedBrowserWebviewActivation = {
  created: boolean;
  entry: ManagedBrowserWebviewEntry;
  navigated: boolean;
};

const WEBVIEW_CACHE_LIMIT = 5;

const managedBrowserWebviews = new Map<string, ManagedBrowserWebviewEntry>();
let hasClaimedStartupCleanup = false;

export function buildManagedBrowserWebviewCacheKey(
  projectKey: string,
  frameVersion: number
): string {
  return `${projectKey}:${frameVersion}`;
}

export function claimBrowserWebviewStartupCleanup(): boolean {
  if (hasClaimedStartupCleanup) return false;
  hasClaimedStartupCleanup = true;
  return true;
}

export function getManagedBrowserWebview(
  cacheKey: string
): ManagedBrowserWebviewEntry | null {
  return managedBrowserWebviews.get(cacheKey) ?? null;
}

export function getMostRecentManagedBrowserWebviewForProject(
  projectKey: string
): ManagedBrowserWebviewEntry | null {
  const entries = Array.from(managedBrowserWebviews.values()).reverse();
  return entries.find((entry) => entry.projectKey === projectKey) ?? null;
}

export function hasManagedBrowserWebview(cacheKey: string): boolean {
  return managedBrowserWebviews.has(cacheKey);
}

export function clearManagedBrowserWebviewPageLoadHandler(
  cacheKey: string
): void {
  managedBrowserWebviews.get(cacheKey)?.handle.setPageLoadHandler(null);
}

export async function hideManagedBrowserWebviewsExcept(
  activeCacheKey: string | null
): Promise<void> {
  await Promise.all(
    Array.from(managedBrowserWebviews.entries()).map(
      async ([cacheKey, entry]) => {
        if (activeCacheKey && cacheKey === activeCacheKey) return;
        await entry.handle.hide().catch(() => undefined);
      }
    )
  );
}

export async function showManagedBrowserWebview(
  cacheKey: string
): Promise<void> {
  await managedBrowserWebviews.get(cacheKey)?.handle.show();
}

export async function activateManagedBrowserWebview({
  cacheKey,
  container,
  createHandle,
  frameVersion,
  isCurrent = () => true,
  onPageLoad,
  projectKey,
  url,
}: {
  cacheKey: string;
  container: HTMLElement;
  createHandle: () => Promise<ManagedBrowserWebviewHandle>;
  frameVersion: number;
  isCurrent?: () => boolean;
  onPageLoad: BrowserWebviewPageLoadHandler;
  projectKey: string;
  url: string;
}): Promise<ManagedBrowserWebviewActivation> {
  const cached = managedBrowserWebviews.get(cacheKey);
  if (cached) {
    if (!isCurrent()) {
      return { created: false, entry: cached, navigated: false };
    }
    cached.handle.attach(container);
    cached.handle.setPageLoadHandler(onPageLoad);
    insertBrowserWebviewCacheEntry(
      managedBrowserWebviews,
      cacheKey,
      cached,
      WEBVIEW_CACHE_LIMIT,
      (evicted) => {
        void evicted.handle.close().catch(() => undefined);
      }
    );

    if (cached.lastUrl === url) {
      return { created: false, entry: cached, navigated: false };
    }

    cached.lastUrl = url;
    await cached.handle.navigate(url);
    return { created: false, entry: cached, navigated: true };
  }

  const handle = await createHandle();
  if (isCurrent()) {
    handle.attach(container);
    handle.setPageLoadHandler(onPageLoad);
  } else {
    handle.setPageLoadHandler(null);
  }
  const entry: ManagedBrowserWebviewEntry = {
    cacheKey,
    frameVersion,
    handle,
    lastUrl: url,
    projectKey,
  };

  insertBrowserWebviewCacheEntry(
    managedBrowserWebviews,
    cacheKey,
    entry,
    WEBVIEW_CACHE_LIMIT,
    (evicted) => {
      void evicted.handle.close().catch(() => undefined);
    }
  );
  await handle.hide().catch(() => undefined);
  return { created: true, entry, navigated: false };
}

export async function closeAllManagedBrowserWebviewsForTest(): Promise<void> {
  const entries = Array.from(managedBrowserWebviews.values());
  managedBrowserWebviews.clear();
  hasClaimedStartupCleanup = false;
  await Promise.all(entries.map((entry) => entry.handle.close()));
}

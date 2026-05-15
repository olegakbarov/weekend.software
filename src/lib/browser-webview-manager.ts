import { insertBrowserWebviewCacheEntry } from "./browser-pane-webviews.ts";
import type { BrowserWebviewPageLoadPayload } from "./embedded-browser-webview.ts";

export type BrowserWebviewPageLoadHandler = (
  payload: BrowserWebviewPageLoadPayload,
) => void;

export type ManagedBrowserWebviewHandle = {
  label: string;
  attach: (container: HTMLElement) => Promise<void>;
  captureScreenshot: () => Promise<string | null>;
  close: () => Promise<void>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  hide: () => Promise<void>;
  navigate: (url: string) => Promise<void>;
  setPageLoadHandler: (handler: BrowserWebviewPageLoadHandler | null) => void;
  show: () => Promise<void>;
};

export type ManagedBrowserWebviewEntry = {
  cacheKey: string;
  frameVersion: number;
  handle: ManagedBrowserWebviewHandle;
  isReady: boolean;
  lastUrl: string;
  projectKey: string;
};

export type ManagedBrowserWebviewActivation = {
  created: boolean;
  entry: ManagedBrowserWebviewEntry;
  navigated: boolean;
};

// Browser-tab switching depends on keeping every running project's native
// webview resident. Stopped or removed projects are closed explicitly instead
// of being evicted by count.
const WEBVIEW_CACHE_LIMIT = Number.POSITIVE_INFINITY;

const managedBrowserWebviews = new Map<string, ManagedBrowserWebviewEntry>();
const pendingManagedBrowserWebviewActivations = new Map<
  string,
  Promise<ManagedBrowserWebviewActivation>
>();
let hasClaimedStartupCleanup = false;

async function closeManagedBrowserWebviewEntries(
  shouldClose: (cacheKey: string, entry: ManagedBrowserWebviewEntry) => boolean,
): Promise<void> {
  const entriesToClose = Array.from(managedBrowserWebviews.entries()).filter(
    ([cacheKey, entry]) => shouldClose(cacheKey, entry),
  );

  for (const [cacheKey, entry] of entriesToClose) {
    if (managedBrowserWebviews.get(cacheKey) !== entry) continue;
    managedBrowserWebviews.delete(cacheKey);
  }

  await Promise.all(
    entriesToClose.map(([, entry]) =>
      entry.handle.close().catch(() => undefined),
    ),
  );
}

async function closeSupersededProjectWebviews(
  projectKey: string,
  activeCacheKey: string,
): Promise<void> {
  await closeManagedBrowserWebviewEntries(
    (cacheKey, entry) =>
      cacheKey !== activeCacheKey && entry.projectKey === projectKey,
  );
}

export async function closeSupersededManagedBrowserWebviews(
  projectKey: string,
  activeCacheKey: string,
): Promise<void> {
  await closeSupersededProjectWebviews(projectKey, activeCacheKey);
}

function getPendingManagedBrowserWebviewActivation(
  cacheKey: string,
): Promise<ManagedBrowserWebviewActivation> | null {
  return pendingManagedBrowserWebviewActivations.get(cacheKey) ?? null;
}

function trackPendingManagedBrowserWebviewActivation(
  cacheKey: string,
  activation: Promise<ManagedBrowserWebviewActivation>,
): Promise<ManagedBrowserWebviewActivation> {
  pendingManagedBrowserWebviewActivations.set(cacheKey, activation);
  const clearPending = (): void => {
    if (pendingManagedBrowserWebviewActivations.get(cacheKey) === activation) {
      pendingManagedBrowserWebviewActivations.delete(cacheKey);
    }
  };
  void activation.then(clearPending, clearPending);
  return activation;
}

export function buildManagedBrowserWebviewCacheKey(
  projectKey: string,
  frameVersion: number,
): string {
  return `${projectKey}:${frameVersion}`;
}

export function claimBrowserWebviewStartupCleanup(): boolean {
  if (hasClaimedStartupCleanup) return false;
  hasClaimedStartupCleanup = true;
  return true;
}

export function getManagedBrowserWebview(
  cacheKey: string,
): ManagedBrowserWebviewEntry | null {
  return managedBrowserWebviews.get(cacheKey) ?? null;
}

export function getMostRecentManagedBrowserWebviewForProject(
  projectKey: string,
): ManagedBrowserWebviewEntry | null {
  const entries = Array.from(managedBrowserWebviews.values()).reverse();
  return entries.find((entry) => entry.projectKey === projectKey) ?? null;
}

export function hasManagedBrowserWebview(cacheKey: string): boolean {
  return managedBrowserWebviews.has(cacheKey);
}

export function updateManagedBrowserWebviewLastUrl(
  cacheKey: string,
  url: string,
): void {
  const normalizedUrl = url.trim();
  if (!normalizedUrl) return;
  const entry = managedBrowserWebviews.get(cacheKey);
  if (!entry) return;
  entry.lastUrl = normalizedUrl;
}

export function updateManagedBrowserWebviewReadyState(
  cacheKey: string,
  isReady: boolean,
): void {
  const entry = managedBrowserWebviews.get(cacheKey);
  if (!entry) return;
  entry.isReady = isReady;
}

export function clearManagedBrowserWebviewPageLoadHandler(
  cacheKey: string,
): void {
  managedBrowserWebviews.get(cacheKey)?.handle.setPageLoadHandler(null);
}

export async function hideManagedBrowserWebviewsExcept(
  activeCacheKey: string | null,
): Promise<void> {
  await Promise.all(
    Array.from(managedBrowserWebviews.entries()).map(
      async ([cacheKey, entry]) => {
        if (activeCacheKey && cacheKey === activeCacheKey) return;
        await entry.handle.hide().catch(() => undefined);
      },
    ),
  );
}

export async function closeManagedBrowserWebviewsExcept(
  activeCacheKey: string | null,
): Promise<void> {
  await closeManagedBrowserWebviewEntries(
    (cacheKey) => !activeCacheKey || cacheKey !== activeCacheKey,
  );
}

export async function closeManagedBrowserWebviewsNotInProjects(
  projectKeys: ReadonlySet<string>,
): Promise<void> {
  await closeManagedBrowserWebviewEntries(
    (_cacheKey, entry) => !projectKeys.has(entry.projectKey),
  );
}

export async function showManagedBrowserWebview(
  cacheKey: string,
): Promise<void> {
  await managedBrowserWebviews.get(cacheKey)?.handle.show();
}

async function activateCachedManagedBrowserWebview({
  cached,
  cacheKey,
  container,
  isCurrent,
  onPageLoad,
  url,
}: {
  cached: ManagedBrowserWebviewEntry;
  cacheKey: string;
  container: HTMLElement;
  isCurrent: () => boolean;
  onPageLoad: BrowserWebviewPageLoadHandler;
  url: string;
}): Promise<ManagedBrowserWebviewActivation> {
  if (!isCurrent()) {
    return { created: false, entry: cached, navigated: false };
  }
  await cached.handle.attach(container);
  if (!isCurrent()) {
    return { created: false, entry: cached, navigated: false };
  }
  cached.handle.setPageLoadHandler(onPageLoad);
  insertBrowserWebviewCacheEntry(
    managedBrowserWebviews,
    cacheKey,
    cached,
    WEBVIEW_CACHE_LIMIT,
    (evicted) => {
      void evicted.handle.close().catch(() => undefined);
    },
  );

  if (cached.lastUrl === url) {
    if (cached.isReady) {
      await cached.handle.show().catch(() => undefined);
      if (isCurrent()) {
        await hideManagedBrowserWebviewsExcept(cacheKey);
        await closeSupersededProjectWebviews(cached.projectKey, cacheKey);
      }
      return { created: false, entry: cached, navigated: false };
    }

    cached.isReady = false;
    await cached.handle.hide().catch(() => undefined);
    await cached.handle.navigate(url);
    return { created: false, entry: cached, navigated: true };
  }

  cached.lastUrl = url;
  cached.isReady = false;
  await cached.handle.hide().catch(() => undefined);
  await cached.handle.navigate(url);
  return { created: false, entry: cached, navigated: true };
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
  const pendingActivation = getPendingManagedBrowserWebviewActivation(cacheKey);
  if (pendingActivation) {
    await pendingActivation.catch(() => undefined);
  }
  const cached = managedBrowserWebviews.get(cacheKey);
  if (cached) {
    return activateCachedManagedBrowserWebview({
      cached,
      cacheKey,
      container,
      isCurrent,
      onPageLoad,
      url,
    });
  }

  const activation = (async (): Promise<ManagedBrowserWebviewActivation> => {
    const handle = await createHandle();
    if (!isCurrent()) {
      handle.setPageLoadHandler(null);
      await handle.close().catch(() => undefined);
      return {
        created: true,
        entry: {
          cacheKey,
          frameVersion,
          handle,
          isReady: false,
          lastUrl: url,
          projectKey,
        },
        navigated: false,
      };
    }

    await handle.attach(container);
    if (!isCurrent()) {
      handle.setPageLoadHandler(null);
      await handle.close().catch(() => undefined);
      return {
        created: true,
        entry: {
          cacheKey,
          frameVersion,
          handle,
          isReady: false,
          lastUrl: url,
          projectKey,
        },
        navigated: false,
      };
    }

    handle.setPageLoadHandler(onPageLoad);
    const entry: ManagedBrowserWebviewEntry = {
      cacheKey,
      frameVersion,
      handle,
      isReady: false,
      lastUrl: url,
      projectKey,
    };
    if (!isCurrent()) {
      handle.setPageLoadHandler(null);
      await handle.close().catch(() => undefined);
      return { created: true, entry, navigated: false };
    }

    insertBrowserWebviewCacheEntry(
      managedBrowserWebviews,
      cacheKey,
      entry,
      WEBVIEW_CACHE_LIMIT,
      (evicted) => {
        void evicted.handle.close().catch(() => undefined);
      },
    );
    await handle.hide().catch(() => undefined);
    return { created: true, entry, navigated: false };
  })();

  return trackPendingManagedBrowserWebviewActivation(cacheKey, activation);
}

export async function prewarmManagedBrowserWebview({
  cacheKey,
  createHandle,
  frameVersion,
  isCurrent = () => true,
  onPageLoad,
  projectKey,
  url,
}: {
  cacheKey: string;
  createHandle: () => Promise<ManagedBrowserWebviewHandle>;
  frameVersion: number;
  isCurrent?: () => boolean;
  onPageLoad: BrowserWebviewPageLoadHandler;
  projectKey: string;
  url: string;
}): Promise<ManagedBrowserWebviewActivation> {
  const pendingActivation = getPendingManagedBrowserWebviewActivation(cacheKey);
  if (pendingActivation) {
    await pendingActivation.catch(() => undefined);
  }
  const cached = managedBrowserWebviews.get(cacheKey);
  if (cached) {
    if (!isCurrent()) {
      return { created: false, entry: cached, navigated: false };
    }
    cached.handle.setPageLoadHandler(onPageLoad);
    insertBrowserWebviewCacheEntry(
      managedBrowserWebviews,
      cacheKey,
      cached,
      WEBVIEW_CACHE_LIMIT,
      (evicted) => {
        void evicted.handle.close().catch(() => undefined);
      },
    );

    if (cached.lastUrl === url) {
      if (!cached.isReady) {
        cached.isReady = false;
        await cached.handle.navigate(url);
        await cached.handle.hide().catch(() => undefined);
        return { created: false, entry: cached, navigated: true };
      }

      await cached.handle.hide().catch(() => undefined);
      return { created: false, entry: cached, navigated: false };
    }

    cached.lastUrl = url;
    cached.isReady = false;
    await cached.handle.navigate(url);
    await cached.handle.hide().catch(() => undefined);
    return { created: false, entry: cached, navigated: true };
  }

  const activation = (async (): Promise<ManagedBrowserWebviewActivation> => {
    const handle = await createHandle();
    if (!isCurrent()) {
      handle.setPageLoadHandler(null);
      await handle.close().catch(() => undefined);
      return {
        created: true,
        entry: {
          cacheKey,
          frameVersion,
          handle,
          isReady: false,
          lastUrl: url,
          projectKey,
        },
        navigated: false,
      };
    }

    handle.setPageLoadHandler(onPageLoad);
    const entry: ManagedBrowserWebviewEntry = {
      cacheKey,
      frameVersion,
      handle,
      isReady: false,
      lastUrl: url,
      projectKey,
    };
    await closeSupersededProjectWebviews(projectKey, cacheKey);
    insertBrowserWebviewCacheEntry(
      managedBrowserWebviews,
      cacheKey,
      entry,
      WEBVIEW_CACHE_LIMIT,
      (evicted) => {
        void evicted.handle.close().catch(() => undefined);
      },
    );
    await handle.hide().catch(() => undefined);
    return { created: true, entry, navigated: false };
  })();

  return trackPendingManagedBrowserWebviewActivation(cacheKey, activation);
}

export async function closeAllManagedBrowserWebviewsForTest(): Promise<void> {
  const entries = Array.from(managedBrowserWebviews.values());
  managedBrowserWebviews.clear();
  pendingManagedBrowserWebviewActivations.clear();
  hasClaimedStartupCleanup = false;
  await Promise.all(entries.map((entry) => entry.handle.close()));
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    void closeAllManagedBrowserWebviewsForTest().catch(() => undefined);
  });
}

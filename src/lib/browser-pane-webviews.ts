export const BROWSER_PANE_WEBVIEW_LABEL_PREFIX = "browser-pane:";

export function isBrowserPaneWebviewLabel(label: string): boolean {
  return label.startsWith(BROWSER_PANE_WEBVIEW_LABEL_PREFIX);
}

export type BrowserPaneVisibilityPlan = {
  hideActivePaneViaHandle: boolean;
  inactivePaneExclusionLabel: string | null;
  showActivePaneViaHandle: boolean;
};

export function getInactiveBrowserPaneWebviewLabels(
  labels: readonly string[],
  activeLabel?: string | null
): string[] {
  const normalizedActiveLabel = activeLabel?.trim() || null;
  return labels.filter(
    (label) =>
      isBrowserPaneWebviewLabel(label) &&
      (normalizedActiveLabel === null || label !== normalizedActiveLabel)
  );
}

export function planBrowserPaneVisibility(args: {
  activeLabel?: string | null;
  shouldShowActivePane: boolean;
}): BrowserPaneVisibilityPlan {
  const normalizedActiveLabel = args.activeLabel?.trim() || null;
  return {
    hideActivePaneViaHandle:
      normalizedActiveLabel !== null && !args.shouldShowActivePane,
    inactivePaneExclusionLabel: normalizedActiveLabel,
    showActivePaneViaHandle:
      normalizedActiveLabel !== null && args.shouldShowActivePane,
  };
}

/**
 * Insert `entry` at `key` in `cache`, evicting the oldest entries until the
 * cache is no larger than `limit`. The eviction callback is invoked for each
 * entry that is removed (oldest-first). This is the LRU policy used by the
 * desktop browser pane to keep prior projects' webviews resident across
 * project switches without unbounded memory growth.
 *
 * Semantics:
 *  - If `key` already exists, it's first removed so the re-insert bumps its
 *    LRU recency (Map iteration order = insertion order in JS).
 *  - The current insertion is never evicted, even if `limit` is 0.
 */
export function insertBrowserWebviewCacheEntry<T>(
  cache: Map<string, T>,
  key: string,
  entry: T,
  limit: number,
  onEvict: (entry: T) => void
): void {
  cache.delete(key);
  cache.set(key, entry);
  while (cache.size > Math.max(0, limit)) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (oldestKey === undefined || oldestKey === key) break;
    const evicted = cache.get(oldestKey);
    cache.delete(oldestKey);
    if (evicted !== undefined) {
      onEvict(evicted);
    }
  }
}

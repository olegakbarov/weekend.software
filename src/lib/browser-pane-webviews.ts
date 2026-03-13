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

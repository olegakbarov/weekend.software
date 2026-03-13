import assert from "node:assert/strict";
import test from "node:test";
import {
  getInactiveBrowserPaneWebviewLabels,
  isBrowserPaneWebviewLabel,
  planBrowserPaneVisibility,
} from "./browser-pane-webviews.ts";

test("isBrowserPaneWebviewLabel matches only embedded browser pane labels", () => {
  assert.equal(isBrowserPaneWebviewLabel("browser-pane:sports:0"), true);
  assert.equal(isBrowserPaneWebviewLabel("main"), false);
  assert.equal(isBrowserPaneWebviewLabel("browser-pane"), false);
});

test("getInactiveBrowserPaneWebviewLabels excludes the active browser pane label", () => {
  assert.deepEqual(
    getInactiveBrowserPaneWebviewLabels(
      ["main", "browser-pane:home:0", "browser-pane:sports:1"],
      "browser-pane:sports:1"
    ),
    ["browser-pane:home:0"]
  );
});

test("getInactiveBrowserPaneWebviewLabels returns all browser pane labels when there is no active pane", () => {
  assert.deepEqual(
    getInactiveBrowserPaneWebviewLabels([
      "main",
      "browser-pane:home:0",
      "browser-pane:sandbox:4",
    ]),
    ["browser-pane:home:0", "browser-pane:sandbox:4"]
  );
});

test("planBrowserPaneVisibility hides the active pane via its handle when leaving browser mode", () => {
  assert.deepEqual(
    planBrowserPaneVisibility({
      activeLabel: "browser-pane:sports:3",
      shouldShowActivePane: false,
    }),
    {
      hideActivePaneViaHandle: true,
      inactivePaneExclusionLabel: "browser-pane:sports:3",
      showActivePaneViaHandle: false,
    }
  );
});

test("planBrowserPaneVisibility shows the active pane and excludes it from inactive cleanup in browser mode", () => {
  assert.deepEqual(
    planBrowserPaneVisibility({
      activeLabel: "browser-pane:sports:3",
      shouldShowActivePane: true,
    }),
    {
      hideActivePaneViaHandle: false,
      inactivePaneExclusionLabel: "browser-pane:sports:3",
      showActivePaneViaHandle: true,
    }
  );
});

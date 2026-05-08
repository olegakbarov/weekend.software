import assert from "node:assert/strict";
import test from "node:test";
import {
  getInactiveBrowserPaneWebviewLabels,
  insertBrowserWebviewCacheEntry,
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

test("insertBrowserWebviewCacheEntry evicts the oldest entry when the cap is exceeded", () => {
  type FakeHandle = { id: string };
  const cache = new Map<string, FakeHandle>();
  const evicted: FakeHandle[] = [];
  const insert = (key: string): void =>
    insertBrowserWebviewCacheEntry(cache, key, { id: key }, 5, (entry) => {
      evicted.push(entry);
    });

  insert("a");
  insert("b");
  insert("c");
  insert("d");
  insert("e");
  assert.equal(cache.size, 5);
  assert.equal(evicted.length, 0);

  insert("f");
  assert.equal(cache.size, 5);
  assert.deepEqual(
    evicted.map((entry) => entry.id),
    ["a"]
  );
  assert.deepEqual(Array.from(cache.keys()), ["b", "c", "d", "e", "f"]);
});

test("insertBrowserWebviewCacheEntry bumps recency on re-insert", () => {
  type FakeHandle = { id: string };
  const cache = new Map<string, FakeHandle>();
  const evicted: FakeHandle[] = [];
  const insert = (key: string, entry: FakeHandle): void =>
    insertBrowserWebviewCacheEntry(cache, key, entry, 3, (e) => {
      evicted.push(e);
    });

  insert("a", { id: "a" });
  insert("b", { id: "b" });
  insert("c", { id: "c" });

  // Re-insert "a" - it should become the most recent, leaving "b" the oldest.
  insert("a", cache.get("a")!);
  insert("d", { id: "d" });

  assert.deepEqual(
    evicted.map((entry) => entry.id),
    ["b"]
  );
  assert.deepEqual(Array.from(cache.keys()), ["c", "a", "d"]);
});

test("insertBrowserWebviewCacheEntry never evicts the just-inserted entry even at limit 0", () => {
  type FakeHandle = { id: string };
  const cache = new Map<string, FakeHandle>();
  const evicted: FakeHandle[] = [];

  insertBrowserWebviewCacheEntry(
    cache,
    "only",
    { id: "only" },
    0,
    (entry) => {
      evicted.push(entry);
    }
  );

  assert.equal(cache.size, 1);
  assert.equal(evicted.length, 0);
});

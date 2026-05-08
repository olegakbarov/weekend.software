import assert from "node:assert/strict";
import test from "node:test";
import {
  activateManagedBrowserWebview,
  buildManagedBrowserWebviewCacheKey,
  claimBrowserWebviewStartupCleanup,
  clearManagedBrowserWebviewPageLoadHandler,
  closeAllManagedBrowserWebviewsForTest,
  hideManagedBrowserWebviewsExcept,
  showManagedBrowserWebview,
  type BrowserWebviewPageLoadHandler,
  type ManagedBrowserWebviewHandle,
} from "./browser-webview-manager.ts";

type FakeContainer = HTMLElement & { id: string };

function fakeContainer(id: string): FakeContainer {
  return { id } as FakeContainer;
}

function createFakeHandle(label: string, calls: string[]): ManagedBrowserWebviewHandle {
  let handler: BrowserWebviewPageLoadHandler | null = null;
  return {
    label,
    attach: (container) => {
      calls.push(`attach:${label}:${(container as FakeContainer).id}`);
    },
    close: async () => {
      calls.push(`close:${label}`);
    },
    hide: async () => {
      calls.push(`hide:${label}`);
    },
    navigate: async (url) => {
      calls.push(`navigate:${label}:${url}`);
    },
    setPageLoadHandler: (nextHandler) => {
      handler = nextHandler;
      calls.push(`handler:${label}:${handler ? "set" : "clear"}`);
    },
    show: async () => {
      calls.push(`show:${label}`);
    },
  };
}

test("managed browser webviews are reused across activations", async () => {
  await closeAllManagedBrowserWebviewsForTest();
  const calls: string[] = [];
  let creates = 0;
  const cacheKey = buildManagedBrowserWebviewCacheKey("alpha", 0);

  const first = await activateManagedBrowserWebview({
    cacheKey,
    container: fakeContainer("one"),
    frameVersion: 0,
    projectKey: "alpha",
    createHandle: async () => {
      creates += 1;
      return createFakeHandle("browser-pane:alpha:0", calls);
    },
    onPageLoad: () => undefined,
    url: "http://alpha.localhost:1355/",
  });

  const second = await activateManagedBrowserWebview({
    cacheKey,
    container: fakeContainer("two"),
    frameVersion: 0,
    projectKey: "alpha",
    createHandle: async () => {
      creates += 1;
      return createFakeHandle("browser-pane:alpha:0", calls);
    },
    onPageLoad: () => undefined,
    url: "http://alpha.localhost:1355/",
  });

  assert.equal(creates, 1);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.navigated, false);
  assert.equal(first.entry.handle, second.entry.handle);
  assert.deepEqual(calls, [
    "attach:browser-pane:alpha:0:one",
    "handler:browser-pane:alpha:0:set",
    "hide:browser-pane:alpha:0",
    "attach:browser-pane:alpha:0:two",
    "handler:browser-pane:alpha:0:set",
  ]);

  await closeAllManagedBrowserWebviewsForTest();
});

test("managed browser webviews navigate in place when url changes", async () => {
  await closeAllManagedBrowserWebviewsForTest();
  const calls: string[] = [];
  const cacheKey = buildManagedBrowserWebviewCacheKey("alpha", 0);

  await activateManagedBrowserWebview({
    cacheKey,
    container: fakeContainer("one"),
    frameVersion: 0,
    projectKey: "alpha",
    createHandle: async () => createFakeHandle("browser-pane:alpha:0", calls),
    onPageLoad: () => undefined,
    url: "http://alpha.localhost:1355/",
  });

  const second = await activateManagedBrowserWebview({
    cacheKey,
    container: fakeContainer("one"),
    frameVersion: 0,
    projectKey: "alpha",
    createHandle: async () => createFakeHandle("browser-pane:alpha:0", calls),
    onPageLoad: () => undefined,
    url: "http://alpha.localhost:1355/deep",
  });

  assert.equal(second.created, false);
  assert.equal(second.navigated, true);
  assert.ok(calls.includes("navigate:browser-pane:alpha:0:http://alpha.localhost:1355/deep"));

  await closeAllManagedBrowserWebviewsForTest();
});

test("managed browser webview startup cleanup is claimed once", async () => {
  await closeAllManagedBrowserWebviewsForTest();
  assert.equal(claimBrowserWebviewStartupCleanup(), true);
  assert.equal(claimBrowserWebviewStartupCleanup(), false);
});

test("managed browser webviews hide and show by active cache key", async () => {
  await closeAllManagedBrowserWebviewsForTest();
  const calls: string[] = [];
  const alphaKey = buildManagedBrowserWebviewCacheKey("alpha", 0);
  const betaKey = buildManagedBrowserWebviewCacheKey("beta", 0);

  await activateManagedBrowserWebview({
    cacheKey: alphaKey,
    container: fakeContainer("alpha"),
    frameVersion: 0,
    projectKey: "alpha",
    createHandle: async () => createFakeHandle("browser-pane:alpha:0", calls),
    onPageLoad: () => undefined,
    url: "http://alpha.localhost:1355/",
  });
  await activateManagedBrowserWebview({
    cacheKey: betaKey,
    container: fakeContainer("beta"),
    frameVersion: 0,
    projectKey: "beta",
    createHandle: async () => createFakeHandle("browser-pane:beta:0", calls),
    onPageLoad: () => undefined,
    url: "http://beta.localhost:1355/",
  });

  await hideManagedBrowserWebviewsExcept(betaKey);
  await showManagedBrowserWebview(betaKey);
  clearManagedBrowserWebviewPageLoadHandler(betaKey);

  assert.ok(calls.includes("hide:browser-pane:alpha:0"));
  assert.ok(calls.includes("show:browser-pane:beta:0"));
  assert.ok(calls.includes("handler:browser-pane:beta:0:clear"));

  await closeAllManagedBrowserWebviewsForTest();
});

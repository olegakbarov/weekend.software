import assert from "node:assert/strict";
import test from "node:test";
import {
  activateManagedBrowserWebview,
  buildManagedBrowserWebviewCacheKey,
  claimBrowserWebviewStartupCleanup,
  clearManagedBrowserWebviewPageLoadHandler,
  closeAllManagedBrowserWebviewsForTest,
  closeManagedBrowserWebviewsExcept,
  closeManagedBrowserWebviewsNotInProjects,
  closeSupersededManagedBrowserWebviews,
  hideManagedBrowserWebviewsExcept,
  prewarmManagedBrowserWebview,
  showManagedBrowserWebview,
  updateManagedBrowserWebviewLastUrl,
  updateManagedBrowserWebviewReadyState,
  type BrowserWebviewPageLoadHandler,
  type ManagedBrowserWebviewHandle,
} from "./browser-webview-manager.ts";

type FakeContainer = HTMLElement & { id: string };

function fakeContainer(id: string): FakeContainer {
  return { id } as FakeContainer;
}

function createFakeHandle(
  label: string,
  calls: string[],
): ManagedBrowserWebviewHandle {
  let handler: BrowserWebviewPageLoadHandler | null = null;
  return {
    label,
    attach: async (container) => {
      calls.push(`attach:${label}:${(container as FakeContainer).id}`);
    },
    captureScreenshot: async () => null,
    close: async () => {
      calls.push(`close:${label}`);
    },
    goBack: async () => {
      calls.push(`back:${label}`);
    },
    goForward: async () => {
      calls.push(`forward:${label}`);
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
  updateManagedBrowserWebviewReadyState(cacheKey, true);

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
    "show:browser-pane:alpha:0",
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
  assert.ok(
    calls.includes(
      "navigate:browser-pane:alpha:0:http://alpha.localhost:1355/deep",
    ),
  );

  await closeAllManagedBrowserWebviewsForTest();
});

test("managed browser webviews use refreshed lastUrl when reactivated", async () => {
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

  updateManagedBrowserWebviewLastUrl(
    cacheKey,
    "http://alpha.localhost:1355/deep",
  );
  updateManagedBrowserWebviewReadyState(cacheKey, true);

  const second = await activateManagedBrowserWebview({
    cacheKey,
    container: fakeContainer("two"),
    frameVersion: 0,
    projectKey: "alpha",
    createHandle: async () => createFakeHandle("browser-pane:alpha:0", calls),
    onPageLoad: () => undefined,
    url: "http://alpha.localhost:1355/deep",
  });

  assert.equal(second.created, false);
  assert.equal(second.navigated, false);
  assert.equal(
    calls.some((call) => call.startsWith("navigate:browser-pane:alpha:0:")),
    false,
  );

  await closeAllManagedBrowserWebviewsForTest();
});

test("managed browser webviews show ready cached frames during activation", async () => {
  await closeAllManagedBrowserWebviewsForTest();
  const calls: string[] = [];
  const cacheKey = buildManagedBrowserWebviewCacheKey("alpha", 0);

  await prewarmManagedBrowserWebview({
    cacheKey,
    createHandle: async () => createFakeHandle("browser-pane:alpha:0", calls),
    frameVersion: 0,
    onPageLoad: () => undefined,
    projectKey: "alpha",
    url: "http://alpha.localhost:1355/",
  });
  updateManagedBrowserWebviewReadyState(cacheKey, true);

  const activation = await activateManagedBrowserWebview({
    cacheKey,
    container: fakeContainer("visible"),
    frameVersion: 0,
    projectKey: "alpha",
    createHandle: async () => createFakeHandle("browser-pane:alpha:0", calls),
    onPageLoad: () => undefined,
    url: "http://alpha.localhost:1355/",
  });

  assert.equal(activation.created, false);
  assert.ok(calls.includes("attach:browser-pane:alpha:0:visible"));
  assert.ok(calls.includes("show:browser-pane:alpha:0"));

  await closeAllManagedBrowserWebviewsForTest();
});

test("managed browser webviews show ready cached frame before hiding previous project", async () => {
  await closeAllManagedBrowserWebviewsForTest();
  const calls: string[] = [];
  const alphaKey = buildManagedBrowserWebviewCacheKey("alpha", 0);
  const betaKey = buildManagedBrowserWebviewCacheKey("beta", 0);

  await prewarmManagedBrowserWebview({
    cacheKey: alphaKey,
    createHandle: async () => createFakeHandle("browser-pane:alpha:0", calls),
    frameVersion: 0,
    onPageLoad: () => undefined,
    projectKey: "alpha",
    url: "http://alpha.localhost:1355/",
  });
  await prewarmManagedBrowserWebview({
    cacheKey: betaKey,
    createHandle: async () => createFakeHandle("browser-pane:beta:0", calls),
    frameVersion: 0,
    onPageLoad: () => undefined,
    projectKey: "beta",
    url: "http://beta.localhost:1355/",
  });
  updateManagedBrowserWebviewReadyState(alphaKey, true);
  updateManagedBrowserWebviewReadyState(betaKey, true);
  await showManagedBrowserWebview(betaKey);

  await activateManagedBrowserWebview({
    cacheKey: alphaKey,
    container: fakeContainer("visible"),
    frameVersion: 0,
    projectKey: "alpha",
    createHandle: async () => createFakeHandle("browser-pane:alpha:0", calls),
    onPageLoad: () => undefined,
    url: "http://alpha.localhost:1355/",
  });

  const alphaShowIndex = calls.lastIndexOf("show:browser-pane:alpha:0");
  const betaHideIndex = calls.lastIndexOf("hide:browser-pane:beta:0");
  assert.ok(alphaShowIndex >= 0);
  assert.ok(betaHideIndex >= 0);
  assert.ok(alphaShowIndex < betaHideIndex);

  await closeAllManagedBrowserWebviewsForTest();
});

test("managed browser webviews reload same-url cached frames that are not ready", async () => {
  await closeAllManagedBrowserWebviewsForTest();
  const calls: string[] = [];
  const cacheKey = buildManagedBrowserWebviewCacheKey("alpha", 0);

  await prewarmManagedBrowserWebview({
    cacheKey,
    createHandle: async () => createFakeHandle("browser-pane:alpha:0", calls),
    frameVersion: 0,
    onPageLoad: () => undefined,
    projectKey: "alpha",
    url: "http://alpha.localhost:1355/",
  });

  const activation = await activateManagedBrowserWebview({
    cacheKey,
    container: fakeContainer("visible"),
    frameVersion: 0,
    projectKey: "alpha",
    createHandle: async () => createFakeHandle("browser-pane:alpha:0", calls),
    onPageLoad: () => undefined,
    url: "http://alpha.localhost:1355/",
  });

  assert.equal(activation.created, false);
  assert.equal(activation.navigated, true);
  assert.ok(
    calls.includes(
      "navigate:browser-pane:alpha:0:http://alpha.localhost:1355/",
    ),
  );
  assert.equal(
    calls[
      calls.indexOf(
        "navigate:browser-pane:alpha:0:http://alpha.localhost:1355/",
      ) - 1
    ],
    "hide:browser-pane:alpha:0",
  );
  assert.equal(
    calls.filter((call) => call === "show:browser-pane:alpha:0").length,
    0,
  );

  await closeAllManagedBrowserWebviewsForTest();
});

test("managed browser prewarm reloads same-url cached frames that are not ready", async () => {
  await closeAllManagedBrowserWebviewsForTest();
  const calls: string[] = [];
  const cacheKey = buildManagedBrowserWebviewCacheKey("alpha", 0);

  await prewarmManagedBrowserWebview({
    cacheKey,
    createHandle: async () => createFakeHandle("browser-pane:alpha:0", calls),
    frameVersion: 0,
    onPageLoad: () => undefined,
    projectKey: "alpha",
    url: "http://alpha.localhost:1355/",
  });

  const activation = await prewarmManagedBrowserWebview({
    cacheKey,
    createHandle: async () => createFakeHandle("browser-pane:alpha:0", calls),
    frameVersion: 0,
    onPageLoad: () => undefined,
    projectKey: "alpha",
    url: "http://alpha.localhost:1355/",
  });

  assert.equal(activation.created, false);
  assert.equal(activation.navigated, true);
  assert.ok(
    calls.includes(
      "navigate:browser-pane:alpha:0:http://alpha.localhost:1355/",
    ),
  );

  await closeAllManagedBrowserWebviewsForTest();
});

test("stale managed browser prewarm does not mutate cached active frame", async () => {
  await closeAllManagedBrowserWebviewsForTest();
  const calls: string[] = [];
  const cacheKey = buildManagedBrowserWebviewCacheKey("alpha", 0);

  await activateManagedBrowserWebview({
    cacheKey,
    container: fakeContainer("visible"),
    createHandle: async () => createFakeHandle("browser-pane:alpha:0", calls),
    frameVersion: 0,
    onPageLoad: () => undefined,
    projectKey: "alpha",
    url: "http://alpha.localhost:1355/",
  });

  calls.length = 0;
  const prewarm = await prewarmManagedBrowserWebview({
    cacheKey,
    createHandle: async () =>
      createFakeHandle("browser-pane:alpha:0-next", calls),
    frameVersion: 0,
    isCurrent: () => false,
    onPageLoad: () => undefined,
    projectKey: "alpha",
    url: "http://alpha.localhost:1355/",
  });

  assert.equal(prewarm.created, false);
  assert.equal(prewarm.navigated, false);
  assert.deepEqual(calls, []);

  await closeAllManagedBrowserWebviewsForTest();
});

test("managed browser webviews retain previous projects when activating another project", async () => {
  await closeAllManagedBrowserWebviewsForTest();
  const calls: string[] = [];
  let alphaCreates = 0;
  const alphaKey = buildManagedBrowserWebviewCacheKey("alpha", 0);
  const betaKey = buildManagedBrowserWebviewCacheKey("beta", 0);

  const firstAlpha = await activateManagedBrowserWebview({
    cacheKey: alphaKey,
    container: fakeContainer("alpha"),
    frameVersion: 0,
    projectKey: "alpha",
    createHandle: async () => {
      alphaCreates += 1;
      return createFakeHandle("browser-pane:alpha:0", calls);
    },
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

  assert.equal(
    calls.filter((call) => call === "close:browser-pane:alpha:0").length,
    0,
  );
  assert.ok(calls.includes("hide:browser-pane:alpha:0"));

  const secondAlpha = await activateManagedBrowserWebview({
    cacheKey: alphaKey,
    container: fakeContainer("alpha-again"),
    frameVersion: 0,
    projectKey: "alpha",
    createHandle: async () => {
      alphaCreates += 1;
      return createFakeHandle("browser-pane:alpha:0", calls);
    },
    onPageLoad: () => undefined,
    url: "http://alpha.localhost:1355/",
  });

  assert.equal(alphaCreates, 1);
  assert.equal(secondAlpha.created, false);
  assert.equal(secondAlpha.entry.handle, firstAlpha.entry.handle);
  assert.ok(calls.includes("attach:browser-pane:alpha:0:alpha-again"));
  assert.equal(
    calls.filter((call) => call === "close:browser-pane:beta:0").length,
    0,
  );
  assert.ok(calls.includes("hide:browser-pane:beta:0"));

  await closeAllManagedBrowserWebviewsForTest();

  assert.equal(
    calls.filter((call) => call === "close:browser-pane:alpha:0").length,
    1,
  );
  assert.equal(
    calls.filter((call) => call === "close:browser-pane:beta:0").length,
    1,
  );
});

test("managed browser webviews retain running projects without count eviction", async () => {
  await closeAllManagedBrowserWebviewsForTest();
  const calls: string[] = [];

  for (const project of ["one", "two", "three", "four", "five", "six"]) {
    await activateManagedBrowserWebview({
      cacheKey: buildManagedBrowserWebviewCacheKey(project, 0),
      container: fakeContainer(project),
      frameVersion: 0,
      projectKey: project,
      createHandle: async () =>
        createFakeHandle(`browser-pane:${project}:0`, calls),
      onPageLoad: () => undefined,
      url: `http://${project}.localhost:1355/`,
    });
  }

  assert.equal(
    calls.filter((call) => call === "close:browser-pane:one:0").length,
    0,
  );
  assert.equal(
    calls.filter((call) => call === "close:browser-pane:six:0").length,
    0,
  );

  await closeAllManagedBrowserWebviewsForTest();
});

test("managed browser webviews close projects that are no longer running", async () => {
  await closeAllManagedBrowserWebviewsForTest();
  const calls: string[] = [];

  for (const project of ["alpha", "beta"]) {
    await activateManagedBrowserWebview({
      cacheKey: buildManagedBrowserWebviewCacheKey(project, 0),
      container: fakeContainer(project),
      frameVersion: 0,
      projectKey: project,
      createHandle: async () =>
        createFakeHandle(`browser-pane:${project}:0`, calls),
      onPageLoad: () => undefined,
      url: `http://${project}.localhost:1355/`,
    });
  }

  await closeManagedBrowserWebviewsNotInProjects(new Set(["beta"]));

  assert.equal(
    calls.filter((call) => call === "close:browser-pane:alpha:0").length,
    1,
  );
  assert.equal(
    calls.filter((call) => call === "close:browser-pane:beta:0").length,
    0,
  );

  await closeAllManagedBrowserWebviewsForTest();
});

test("managed browser webview prewarm deduplicates in-flight creates", async () => {
  await closeAllManagedBrowserWebviewsForTest();
  const calls: string[] = [];
  const cacheKey = buildManagedBrowserWebviewCacheKey("alpha", 0);
  let creates = 0;
  let releaseCreate: (() => void) | null = null;
  const createReleased = new Promise<void>((resolve) => {
    releaseCreate = resolve;
  });

  const createHandle = async () => {
    creates += 1;
    await createReleased;
    return createFakeHandle("browser-pane:alpha:0", calls);
  };

  const first = prewarmManagedBrowserWebview({
    cacheKey,
    createHandle,
    frameVersion: 0,
    onPageLoad: () => undefined,
    projectKey: "alpha",
    url: "http://alpha.localhost:1355/",
  });
  const second = prewarmManagedBrowserWebview({
    cacheKey,
    createHandle,
    frameVersion: 0,
    onPageLoad: () => undefined,
    projectKey: "alpha",
    url: "http://alpha.localhost:1355/",
  });

  releaseCreate?.();
  const [firstActivation, secondActivation] = await Promise.all([
    first,
    second,
  ]);

  assert.equal(creates, 1);
  assert.equal(firstActivation.created, true);
  assert.equal(secondActivation.created, false);
  assert.equal(firstActivation.entry.handle, secondActivation.entry.handle);

  await closeAllManagedBrowserWebviewsForTest();
});

test("managed browser activation reuses an in-flight prewarm", async () => {
  await closeAllManagedBrowserWebviewsForTest();
  const calls: string[] = [];
  const cacheKey = buildManagedBrowserWebviewCacheKey("alpha", 0);
  let creates = 0;
  let releaseCreate: (() => void) | null = null;
  const createReleased = new Promise<void>((resolve) => {
    releaseCreate = resolve;
  });

  const createHandle = async () => {
    creates += 1;
    await createReleased;
    return createFakeHandle("browser-pane:alpha:0", calls);
  };

  const prewarm = prewarmManagedBrowserWebview({
    cacheKey,
    createHandle,
    frameVersion: 0,
    onPageLoad: () => undefined,
    projectKey: "alpha",
    url: "http://alpha.localhost:1355/",
  });
  const activation = activateManagedBrowserWebview({
    cacheKey,
    container: fakeContainer("visible"),
    createHandle,
    frameVersion: 0,
    onPageLoad: () => undefined,
    projectKey: "alpha",
    url: "http://alpha.localhost:1355/",
  });

  releaseCreate?.();
  const [prewarmActivation, visibleActivation] = await Promise.all([
    prewarm,
    activation,
  ]);

  assert.equal(creates, 1);
  assert.equal(prewarmActivation.created, true);
  assert.equal(visibleActivation.created, false);
  assert.equal(prewarmActivation.entry.handle, visibleActivation.entry.handle);
  assert.ok(calls.includes("attach:browser-pane:alpha:0:visible"));

  await closeAllManagedBrowserWebviewsForTest();
});

test("stale managed browser prewarm creates close without entering cache", async () => {
  await closeAllManagedBrowserWebviewsForTest();
  const calls: string[] = [];
  const cacheKey = buildManagedBrowserWebviewCacheKey("alpha", 0);
  let creates = 0;

  await prewarmManagedBrowserWebview({
    cacheKey,
    createHandle: async () => {
      creates += 1;
      return createFakeHandle("browser-pane:alpha:0", calls);
    },
    frameVersion: 0,
    isCurrent: () => false,
    onPageLoad: () => undefined,
    projectKey: "alpha",
    url: "http://alpha.localhost:1355/",
  });

  const activation = await activateManagedBrowserWebview({
    cacheKey,
    container: fakeContainer("visible"),
    createHandle: async () => {
      creates += 1;
      return createFakeHandle("browser-pane:alpha:0-next", calls);
    },
    frameVersion: 0,
    onPageLoad: () => undefined,
    projectKey: "alpha",
    url: "http://alpha.localhost:1355/",
  });

  assert.equal(creates, 2);
  assert.equal(activation.created, true);
  assert.ok(calls.includes("close:browser-pane:alpha:0"));
  assert.ok(calls.includes("attach:browser-pane:alpha:0-next:visible"));

  await closeAllManagedBrowserWebviewsForTest();
});

test("managed browser webviews defer closing older project frames until active frame is ready", async () => {
  await closeAllManagedBrowserWebviewsForTest();
  const calls: string[] = [];
  const firstKey = buildManagedBrowserWebviewCacheKey("alpha", 0);
  const secondKey = buildManagedBrowserWebviewCacheKey("alpha", 1);

  await activateManagedBrowserWebview({
    cacheKey: firstKey,
    container: fakeContainer("one"),
    frameVersion: 0,
    projectKey: "alpha",
    createHandle: async () => createFakeHandle("browser-pane:alpha:0", calls),
    onPageLoad: () => undefined,
    url: "http://alpha.localhost:1355/",
  });

  await activateManagedBrowserWebview({
    cacheKey: secondKey,
    container: fakeContainer("two"),
    frameVersion: 1,
    projectKey: "alpha",
    createHandle: async () => createFakeHandle("browser-pane:alpha:1", calls),
    onPageLoad: () => undefined,
    url: "http://alpha.localhost:1355/",
  });

  assert.equal(
    calls.filter((call) => call === "close:browser-pane:alpha:0").length,
    0,
  );

  await closeSupersededManagedBrowserWebviews("alpha", secondKey);

  assert.ok(calls.includes("close:browser-pane:alpha:0"));

  await closeAllManagedBrowserWebviewsForTest();

  assert.equal(
    calls.filter((call) => call === "close:browser-pane:alpha:0").length,
    1,
  );
  assert.equal(
    calls.filter((call) => call === "close:browser-pane:alpha:1").length,
    1,
  );
});

test("stale managed browser webview creates close without entering cache", async () => {
  await closeAllManagedBrowserWebviewsForTest();
  const calls: string[] = [];
  const currentKey = buildManagedBrowserWebviewCacheKey("alpha", 1);
  const staleKey = buildManagedBrowserWebviewCacheKey("alpha", 0);

  await activateManagedBrowserWebview({
    cacheKey: currentKey,
    container: fakeContainer("current"),
    frameVersion: 1,
    projectKey: "alpha",
    createHandle: async () => createFakeHandle("browser-pane:alpha:1", calls),
    onPageLoad: () => undefined,
    url: "http://alpha.localhost:1355/",
  });

  const stale = await activateManagedBrowserWebview({
    cacheKey: staleKey,
    container: fakeContainer("stale"),
    frameVersion: 0,
    projectKey: "alpha",
    createHandle: async () => createFakeHandle("browser-pane:alpha:0", calls),
    isCurrent: () => false,
    onPageLoad: () => undefined,
    url: "http://alpha.localhost:1355/",
  });

  assert.equal(stale.created, true);
  assert.ok(calls.includes("handler:browser-pane:alpha:0:clear"));
  assert.ok(calls.includes("close:browser-pane:alpha:0"));
  assert.equal(
    calls.filter((call) => call === "close:browser-pane:alpha:1").length,
    0,
  );

  await closeAllManagedBrowserWebviewsForTest();

  assert.equal(
    calls.filter((call) => call === "close:browser-pane:alpha:1").length,
    1,
  );
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

  await activateManagedBrowserWebview({
    cacheKey: alphaKey,
    container: fakeContainer("alpha"),
    frameVersion: 0,
    projectKey: "alpha",
    createHandle: async () => createFakeHandle("browser-pane:alpha:0", calls),
    onPageLoad: () => undefined,
    url: "http://alpha.localhost:1355/",
  });

  await hideManagedBrowserWebviewsExcept(null);
  await showManagedBrowserWebview(alphaKey);
  clearManagedBrowserWebviewPageLoadHandler(alphaKey);

  assert.ok(calls.includes("hide:browser-pane:alpha:0"));
  assert.ok(calls.includes("show:browser-pane:alpha:0"));
  assert.ok(calls.includes("handler:browser-pane:alpha:0:clear"));

  await closeAllManagedBrowserWebviewsForTest();
});

test("managed browser webviews close inactive entries by cache key", async () => {
  await closeAllManagedBrowserWebviewsForTest();
  const calls: string[] = [];
  const alphaKey = buildManagedBrowserWebviewCacheKey("alpha", 0);

  await activateManagedBrowserWebview({
    cacheKey: alphaKey,
    container: fakeContainer("alpha"),
    frameVersion: 0,
    projectKey: "alpha",
    createHandle: async () => createFakeHandle("browser-pane:alpha:0", calls),
    onPageLoad: () => undefined,
    url: "http://alpha.localhost:1355/",
  });

  await closeManagedBrowserWebviewsExcept(null);

  assert.equal(
    calls.filter((call) => call === "close:browser-pane:alpha:0").length,
    1,
  );

  await closeAllManagedBrowserWebviewsForTest();
});

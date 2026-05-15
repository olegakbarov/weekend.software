import assert from "node:assert/strict";
import test from "node:test";
import { shouldRenderNativeBrowserWebviewHost } from "./browser-runtime.ts";

test("native browser host renders for ready runtime targets", () => {
  assert.equal(
    shouldRenderNativeBrowserWebviewHost({
      browserTargetStatus: "ready",
      displayRuntimeSurfaceUrl: "http://alpha.localhost:1355/",
      isEmbeddedBrowserAvailable: true,
      isRestoringCachedBrowserFrame: false,
    }),
    true,
  );
});

test("native browser host renders while restoring a ready cached frame", () => {
  assert.equal(
    shouldRenderNativeBrowserWebviewHost({
      browserTargetStatus: "blocked",
      displayRuntimeSurfaceUrl: "http://alpha.localhost:1355/",
      isEmbeddedBrowserAvailable: true,
      isRestoringCachedBrowserFrame: true,
    }),
    true,
  );
});

test("native browser host stays unmounted without a display URL", () => {
  assert.equal(
    shouldRenderNativeBrowserWebviewHost({
      browserTargetStatus: "ready",
      displayRuntimeSurfaceUrl: null,
      isEmbeddedBrowserAvailable: true,
      isRestoringCachedBrowserFrame: false,
    }),
    false,
  );
});


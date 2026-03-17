import assert from "node:assert/strict";
import test from "node:test";
import { shouldHydrateBrowserValueFromConfiguredRuntime } from "./browser-url-utils.ts";

test("hydrates browser state when no stored value exists yet", () => {
  assert.equal(
    shouldHydrateBrowserValueFromConfiguredRuntime(
      null,
      "http://music.localhost:1355/"
    ),
    true
  );
});

test("preserves deep routes on the configured local runtime origin", () => {
  assert.equal(
    shouldHydrateBrowserValueFromConfiguredRuntime(
      "http://music.localhost:1355/dashboard?tab=queue#mix",
      "http://music.localhost:1355/"
    ),
    false
  );
});

test("resets stored browser state when it points at another local runtime origin", () => {
  assert.equal(
    shouldHydrateBrowserValueFromConfiguredRuntime(
      "http://video.localhost:1355/watch",
      "http://music.localhost:1355/"
    ),
    true
  );
});

test("preserves non-local URLs the user intentionally navigated to", () => {
  assert.equal(
    shouldHydrateBrowserValueFromConfiguredRuntime(
      "https://example.com/docs",
      "http://music.localhost:1355/"
    ),
    false
  );
});

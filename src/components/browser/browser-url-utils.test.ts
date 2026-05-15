import assert from "node:assert/strict";
import test from "node:test";
import {
  formatBrowserAddressDisplay,
  preferCachedBrowserValue,
  shouldHydrateBrowserValueFromConfiguredRuntime,
} from "./browser-url-utils.ts";

test("hydrates browser state when no stored value exists yet", () => {
  assert.equal(
    shouldHydrateBrowserValueFromConfiguredRuntime(
      null,
      "http://music.localhost:1355/",
    ),
    true,
  );
});

test("preserves deep routes on the configured local runtime origin", () => {
  assert.equal(
    shouldHydrateBrowserValueFromConfiguredRuntime(
      "http://music.localhost:1355/dashboard?tab=queue#mix",
      "http://music.localhost:1355/",
    ),
    false,
  );
});

test("resets stored browser state when it points at another local runtime origin", () => {
  assert.equal(
    shouldHydrateBrowserValueFromConfiguredRuntime(
      "http://video.localhost:1355/watch",
      "http://music.localhost:1355/",
    ),
    true,
  );
});

test("preserves non-local URLs the user intentionally navigated to", () => {
  assert.equal(
    shouldHydrateBrowserValueFromConfiguredRuntime(
      "https://example.com/docs",
      "http://music.localhost:1355/",
    ),
    false,
  );
});

test("formats local proxy root URLs as browser root", () => {
  assert.equal(
    formatBrowserAddressDisplay("http://sandbox.localhost:1355/"),
    "browser:/",
  );
});

test("formats local proxy deep links as browser plus route", () => {
  assert.equal(
    formatBrowserAddressDisplay(
      "http://sandbox.localhost:1355/dashboard?tab=queue#mix",
    ),
    "browser/dashboard?tab=queue#mix",
  );
});

test("formats bare localhost routes as browser plus route", () => {
  assert.equal(
    formatBrowserAddressDisplay("http://localhost:5173/settings"),
    "browser/settings",
  );
});

test("formats external URLs without protocol", () => {
  assert.equal(
    formatBrowserAddressDisplay("https://example.com/docs"),
    "example.com/docs",
  );
});

test("prefers live cached browser URL over stale stored state", () => {
  assert.equal(
    preferCachedBrowserValue(
      " http://music.localhost:1355/deep ",
      "http://music.localhost:1355/",
    ),
    "http://music.localhost:1355/deep",
  );
});

test("falls back to stored browser state when no cached URL exists", () => {
  assert.equal(
    preferCachedBrowserValue(null, " http://music.localhost:1355/ "),
    "http://music.localhost:1355/",
  );
});

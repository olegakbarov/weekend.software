import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

// `@pierre/diffs/react` mounts a Shadow DOM and spawns a Web Worker on
// import. Tests stub it so we can exercise the wrapper's branching logic
// (empty patch, binary patch, header rendering) without booting the real
// renderer in jsdom.
vi.mock("@pierre/diffs/react", () => ({
  PatchDiff: ({ patch }: { patch: string }) => (
    <pre data-testid="patch-diff">{patch}</pre>
  ),
  WorkerPoolContextProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

import { SplitDiffViewer } from "./split-diff-viewer";

const SAMPLE_PATCH = `diff --git a/x.ts b/x.ts
--- a/x.ts
+++ b/x.ts
@@
-foo
+bar
`;

describe("SplitDiffViewer", () => {
  it("renders the patch when content is non-empty", () => {
    const { getByTestId } = render(
      <SplitDiffViewer patch={SAMPLE_PATCH} path="x.ts" themeType="light" />,
    );
    expect(getByTestId("patch-diff").textContent).toContain("foo");
    expect(getByTestId("patch-diff").textContent).toContain("bar");
  });

  it("shows the empty fallback when patch is whitespace", () => {
    const { container, queryByTestId } = render(
      <SplitDiffViewer patch="   " path="x.ts" themeType="light" />,
    );
    expect(queryByTestId("patch-diff")).toBeNull();
    expect(container.textContent).toContain("No diff available for x.ts");
  });

  it("uses a custom emptyFallback when provided", () => {
    const { container } = render(
      <SplitDiffViewer
        emptyFallback={<span>nothing</span>}
        patch=""
        path="x.ts"
        themeType="light"
      />,
    );
    expect(container.textContent).toContain("nothing");
  });

  it("detects 'Binary files' marker and shows the binary message", () => {
    const binaryPatch = "Binary files a/img.png and b/img.png differ\n";
    const { container, queryByTestId } = render(
      <SplitDiffViewer
        patch={binaryPatch}
        path="img.png"
        themeType="light"
      />,
    );
    expect(queryByTestId("patch-diff")).toBeNull();
    expect(container.textContent).toContain("Binary file / diff unavailable for img.png");
  });

  it("detects 'GIT binary patch' marker (case-insensitive)", () => {
    const binaryPatch = "GIT binary patch\nliteral 100\n";
    const { container } = render(
      <SplitDiffViewer
        patch={binaryPatch}
        path="bin.dat"
        themeType="dark"
      />,
    );
    expect(container.textContent).toContain("Binary file / diff unavailable for bin.dat");
  });

  it("renders the header above the patch", () => {
    const { container } = render(
      <SplitDiffViewer
        header={<div data-testid="header">my header</div>}
        patch={SAMPLE_PATCH}
        path="x.ts"
        themeType="light"
      />,
    );
    const header = container.querySelector('[data-testid="header"]');
    const patch = container.querySelector('[data-testid="patch-diff"]');
    expect(header).not.toBeNull();
    expect(patch).not.toBeNull();
    // header precedes patch in DOM order
    expect(
      header!.compareDocumentPosition(patch!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

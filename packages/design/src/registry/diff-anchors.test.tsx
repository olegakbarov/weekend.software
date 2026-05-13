import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { DiffAnchors } from "./diff-anchors";

describe("DiffAnchors", () => {
  const files = [
    { path: "src/a.ts", status: "M" as const },
    { path: "lib/b.ts", status: "A" as const },
    { path: "old.ts", status: "D" as const },
  ];

  it("renders a button per file with the full path preserved", () => {
    const { container } = render(
      <DiffAnchors activePath={null} files={files} onSelect={() => {}} />,
    );
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.length).toBe(3);
    expect(buttons[0]!.textContent).toContain("src/a.ts");
    expect(buttons[1]!.textContent).toContain("lib/b.ts");
    expect(buttons[2]!.textContent).toContain("old.ts");
  });

  it("preserves a trailing-slash folder path", () => {
    const { container } = render(
      <DiffAnchors
        activePath={null}
        files={[{ path: "generated/assets/", status: "U" }]}
        onSelect={() => {}}
      />,
    );
    const button = container.querySelector("button");
    expect(button?.textContent).toContain("generated/assets/");
  });

  it("calls onSelect with the file path on click", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <DiffAnchors activePath={null} files={files} onSelect={onSelect} />,
    );
    const buttons = Array.from(container.querySelectorAll("button"));
    fireEvent.click(buttons[1]!);
    expect(onSelect).toHaveBeenCalledWith("lib/b.ts");
  });

  it("marks the active row with data-active and an accent background", () => {
    const { container } = render(
      <DiffAnchors
        activePath="lib/b.ts"
        files={files}
        onSelect={() => {}}
      />,
    );
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons[0]!.hasAttribute("data-active")).toBe(false);
    expect(buttons[1]!.hasAttribute("data-active")).toBe(true);
    expect(buttons[1]!.className).toContain("bg-accent");
  });

  it("shows an empty state when there are no files", () => {
    const { container } = render(
      <DiffAnchors
        activePath={null}
        files={[]}
        onSelect={() => {}}
        emptyState="Nothing to see"
      />,
    );
    expect(container.textContent).toContain("Nothing to see");
    expect(container.querySelector("button")).toBeNull();
  });

  it("status letter is the first character (A/M/D/R/U)", () => {
    const { container } = render(
      <DiffAnchors activePath={null} files={files} onSelect={() => {}} />,
    );
    const labels = Array.from(container.querySelectorAll("button > span:first-child")).map(
      (s) => s.textContent,
    );
    expect(labels).toEqual(["M", "A", "D"]);
  });
});

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tooltip } from "./tooltip";

describe("Tooltip", () => {
  it("renders the trigger element", () => {
    render(
      <Tooltip content="hello">
        <button type="button">trigger</button>
      </Tooltip>,
    );
    expect(screen.getByRole("button", { name: "trigger" })).toBeTruthy();
  });

  it("does not render content while closed (default state)", () => {
    render(
      <Tooltip content="hello-tip">
        <button type="button">trigger</button>
      </Tooltip>,
    );
    expect(screen.queryByText("hello-tip")).toBeNull();
  });

  it("renders content when forceOpen=true", () => {
    render(
      <Tooltip content="forced-tip" forceOpen>
        <button type="button">trigger</button>
      </Tooltip>,
    );
    // Radix renders content into a portal; querying through document.body picks it up.
    expect(document.body.textContent).toContain("forced-tip");
  });
});

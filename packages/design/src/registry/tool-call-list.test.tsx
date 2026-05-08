import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { ToolCallList, type ToolCallListItem } from "./tool-call-list";

const baseItem = (
  id: string,
  state: ToolCallListItem["state"],
  name = `tool_${id}`,
): ToolCallListItem => ({ id, name, state });

describe("ToolCallList", () => {
  it("renders nothing when items is empty", () => {
    const { container } = render(<ToolCallList items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders only the latest call when there is just one", () => {
    const { getByText, queryByText } = render(
      <ToolCallList items={[baseItem("a", "input-streaming")]} />,
    );
    expect(getByText("tool_a")).toBeTruthy();
    expect(queryByText(/tool calls$/)).toBeNull();
  });

  it("shows summary button with completed count and preview names", () => {
    const items: ToolCallListItem[] = [
      baseItem("a", "output-available", "alpha"),
      baseItem("b", "output-error", "beta"),
      baseItem("c", "input-streaming", "gamma"),
      baseItem("d", "input-streaming", "delta"),
    ];
    const { getByText } = render(<ToolCallList items={items} />);

    expect(getByText("2/3 tool calls")).toBeTruthy();
    expect(getByText("alpha, beta, gamma")).toBeTruthy();
    expect(getByText("delta")).toBeTruthy();
  });

  it("toggles summary expansion on click", () => {
    const items: ToolCallListItem[] = [
      baseItem("a", "output-available", "alpha"),
      baseItem("b", "output-available", "beta"),
      baseItem("c", "input-streaming", "gamma"),
    ];
    const { getByRole, queryByText } = render(<ToolCallList items={items} />);
    const summary = getByRole("button", { expanded: false });

    // Collapsed: previous items not rendered, latest still visible
    expect(queryByText("alpha")).toBeNull();
    expect(queryByText("beta")).toBeNull();
    expect(queryByText("gamma")).toBeTruthy();
    expect(summary.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(summary);
    expect(summary.getAttribute("aria-expanded")).toBe("true");
    expect(queryByText("alpha")).toBeTruthy();
    expect(queryByText("beta")).toBeTruthy();
  });

  it("always renders the latest call regardless of summary state", () => {
    const items: ToolCallListItem[] = [
      baseItem("a", "output-available"),
      baseItem("b", "input-streaming", "live_call"),
    ];
    const { getByText } = render(<ToolCallList items={items} />);
    expect(getByText("live_call")).toBeTruthy();
  });
});

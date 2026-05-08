import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { ToolCall } from "./tool-call";

describe("ToolCall", () => {
  it("renders the tool name and state badge", () => {
    const { getByText } = render(
      <ToolCall name="read_file" state="input-streaming" />,
    );
    expect(getByText("read_file")).toBeTruthy();
    expect(getByText("Processing")).toBeTruthy();
  });

  it("maps each state to its label", () => {
    const states = [
      ["input-streaming", "Processing"],
      ["input-available", "Ready"],
      ["output-available", "Completed"],
      ["output-error", "Error"],
    ] as const;

    for (const [state, label] of states) {
      const { getByText, unmount } = render(
        <ToolCall name="t" state={state} />,
      );
      expect(getByText(label)).toBeTruthy();
      unmount();
    }
  });

  it("disables the disclosure when there is no body", () => {
    const { container } = render(
      <ToolCall name="noop" state="input-streaming" />,
    );
    const button = container.querySelector("button");
    expect(button?.hasAttribute("disabled")).toBe(true);
    expect(button?.getAttribute("aria-expanded")).toBeNull();
  });

  it("renders a record input as key:value rows", () => {
    const { getByText } = render(
      <ToolCall
        name="read_file"
        state="output-available"
        defaultOpen
        input={{ path: "src/index.ts", limit: 10 }}
      />,
    );
    expect(getByText("path:")).toBeTruthy();
    expect(getByText("src/index.ts")).toBeTruthy();
    expect(getByText("limit:")).toBeTruthy();
    expect(getByText("10")).toBeTruthy();
  });

  it("renders a ReactNode slot as-is without auto-formatting", () => {
    const { getByTestId, queryByText } = render(
      <ToolCall
        name="search"
        state="output-available"
        defaultOpen
        output={<pre data-testid="custom-output">custom</pre>}
      />,
    );
    expect(getByTestId("custom-output")).toBeTruthy();
    expect(queryByText("Output")).toBeTruthy();
  });

  it("toggles the body open/closed when the header is clicked", () => {
    const { container, queryByText } = render(
      <ToolCall
        name="t"
        state="output-available"
        input={{ q: "hello" }}
      />,
    );
    expect(queryByText("q:")).toBeNull();
    const button = container.querySelector("button");
    fireEvent.click(button!);
    expect(queryByText("q:")).toBeTruthy();
    fireEvent.click(button!);
  });

  it("shows error text only when state is output-error", () => {
    const { queryByText, rerender } = render(
      <ToolCall
        name="t"
        state="output-available"
        defaultOpen
        errorText="boom"
      />,
    );
    expect(queryByText("boom")).toBeNull();

    rerender(
      <ToolCall
        name="t"
        state="output-error"
        defaultOpen
        errorText="boom"
      />,
    );
    expect(queryByText("boom")).toBeTruthy();
  });

  it("shows the call id when provided", () => {
    const { getByText } = render(
      <ToolCall
        name="t"
        state="output-available"
        defaultOpen
        callId="call_abc123"
      />,
    );
    expect(getByText(/call_abc123/)).toBeTruthy();
  });

  it("ignores empty record slots (no Input section)", () => {
    const { queryByText } = render(
      <ToolCall name="t" state="output-available" defaultOpen input={{}} />,
    );
    expect(queryByText("Input")).toBeNull();
  });
});

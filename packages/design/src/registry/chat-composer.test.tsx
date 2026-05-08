import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { ChatComposer } from "./chat-composer";

function Wrapper({
  initial = "",
  ...props
}: Partial<React.ComponentProps<typeof ChatComposer>> & { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <ChatComposer
      value={value}
      onValueChange={setValue}
      onSubmit={() => {}}
      {...props}
    />
  );
}

describe("ChatComposer", () => {
  it("renders a textarea and a send button by default", () => {
    const { container } = render(<Wrapper />);
    expect(container.querySelector("textarea")).toBeTruthy();
    expect(
      container.querySelector('button[aria-label="Send message"]'),
    ).toBeTruthy();
  });

  it("disables the send button when the value is empty or whitespace", () => {
    const { container, rerender } = render(<Wrapper initial="" />);
    let button = container.querySelector(
      'button[aria-label="Send message"]',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    rerender(<Wrapper initial="   " />);
    button = container.querySelector(
      'button[aria-label="Send message"]',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("submits the trimmed value on Cmd+Enter", () => {
    const onSubmit = vi.fn();
    const { container } = render(<Wrapper initial="  hi  " onSubmit={onSubmit} />);
    const textarea = container.querySelector("textarea")!;
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });
    expect(onSubmit).toHaveBeenCalledWith("hi");
  });

  it("submits the trimmed value on Ctrl+Enter", () => {
    const onSubmit = vi.fn();
    const { container } = render(<Wrapper initial="hello" onSubmit={onSubmit} />);
    const textarea = container.querySelector("textarea")!;
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledWith("hello");
  });

  it("does NOT submit on plain Enter (newline behavior)", () => {
    const onSubmit = vi.fn();
    const { container } = render(<Wrapper initial="hi" onSubmit={onSubmit} />);
    const textarea = container.querySelector("textarea")!;
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("replaces send with stop button while streaming", () => {
    const onAbort = vi.fn();
    const { container } = render(
      <Wrapper isStreaming onAbort={onAbort} />,
    );
    const stop = container.querySelector(
      'button[aria-label="Stop generating"]',
    ) as HTMLButtonElement;
    expect(stop).toBeTruthy();
    expect(
      container.querySelector('button[aria-label="Send message"]'),
    ).toBeNull();
    fireEvent.click(stop);
    expect(onAbort).toHaveBeenCalled();
  });
});

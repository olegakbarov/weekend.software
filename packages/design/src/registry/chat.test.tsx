import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { Chat, type ChatMessageItem } from "./chat";

const userMsg = (id: number, text: string): ChatMessageItem => ({
  id,
  role: "user",
  text,
});
const assistantMsg = (id: number, text: string): ChatMessageItem => ({
  id,
  role: "assistant",
  text,
});

describe("Chat", () => {
  it("renders user and assistant messages", () => {
    const { getByText } = render(
      <Chat
        messages={[userMsg(1, "hello"), assistantMsg(2, "hi there")]}
        status="idle"
        onSend={() => {}}
      />,
    );
    expect(getByText("hello")).toBeTruthy();
    expect(getByText("hi there")).toBeTruthy();
  });

  it("calls onSend with the trimmed prompt on Cmd+Enter", () => {
    const onSend = vi.fn();
    const { container } = render(
      <Chat messages={[]} status="idle" onSend={onSend} />,
    );
    const textarea = container.querySelector("textarea")!;
    fireEvent.change(textarea, { target: { value: "  hi  " } });
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });
    expect(onSend).toHaveBeenCalledWith("hi");
  });

  it("renders the empty-state slot when messages, streaming, and toolCalls are all empty", () => {
    const { getByText } = render(
      <Chat
        messages={[]}
        status="idle"
        onSend={() => {}}
        emptyState={<div>say hi</div>}
      />,
    );
    expect(getByText("say hi")).toBeTruthy();
  });

  it("shows the thinking indicator while streaming with no text yet", () => {
    const { getByText } = render(
      <Chat messages={[]} status="streaming" onSend={() => {}} />,
    );
    expect(getByText(/Thinking/)).toBeTruthy();
  });

  it("hides the thinking indicator once streaming text arrives", () => {
    const { queryByText } = render(
      <Chat
        messages={[]}
        streamingText="generating…"
        status="streaming"
        onSend={() => {}}
      />,
    );
    expect(queryByText(/Thinking/)).toBeNull();
  });

  it("uses a custom renderMarkdown when provided", () => {
    const renderMarkdown = vi.fn((text: string) => (
      <span data-testid="custom">{text}</span>
    ));
    const { getByTestId } = render(
      <Chat
        messages={[assistantMsg(1, "**bold**")]}
        status="idle"
        onSend={() => {}}
        renderMarkdown={renderMarkdown}
      />,
    );
    expect(getByTestId("custom").textContent).toBe("**bold**");
    expect(renderMarkdown).toHaveBeenCalledWith("**bold**", { streaming: false });
  });

  it("calls renderMarkdown with streaming:true for the live streaming bubble", () => {
    const renderMarkdown = vi.fn((text: string) => <span>{text}</span>);
    render(
      <Chat
        messages={[]}
        streamingText="live"
        status="streaming"
        onSend={() => {}}
        renderMarkdown={renderMarkdown}
      />,
    );
    expect(renderMarkdown).toHaveBeenCalledWith("live", { streaming: true });
  });

  it("renders tool calls below their parent message", () => {
    const { getByText } = render(
      <Chat
        messages={[
          {
            id: 1,
            role: "assistant",
            text: "running",
            toolCalls: [
              { id: "t1", name: "read_file", state: "output-available" },
            ],
          },
        ]}
        status="idle"
        onSend={() => {}}
      />,
    );
    expect(getByText("read_file")).toBeTruthy();
  });
});

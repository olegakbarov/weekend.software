import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ChatMessage } from "./chat-message";

describe("ChatMessage", () => {
  it("renders children inside the bubble", () => {
    const { getByText } = render(
      <ChatMessage role="user">hello world</ChatMessage>,
    );
    expect(getByText("hello world")).toBeTruthy();
  });

  it("right-aligns user messages and styles them as primary", () => {
    const { container } = render(
      <ChatMessage role="user">hi</ChatMessage>,
    );
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("ml-auto");
    expect(div.className).toContain("bg-primary");
    expect(div.getAttribute("data-role")).toBe("user");
  });

  it("left-aligns assistant messages on the muted surface", () => {
    const { container } = render(
      <ChatMessage role="assistant">hey</ChatMessage>,
    );
    const div = container.firstChild as HTMLElement;
    expect(div.className).not.toContain("ml-auto");
    expect(div.className).toContain("bg-muted");
    expect(div.getAttribute("data-role")).toBe("assistant");
  });

  it("renders the interrupted footer when set", () => {
    const { getByText } = render(
      <ChatMessage role="assistant" interrupted>
        partial reply
      </ChatMessage>,
    );
    expect(getByText(/interrupted/)).toBeTruthy();
  });

  it("respects a custom max-width override", () => {
    const { container } = render(
      <ChatMessage role="user" maxWidthClassName="max-w-xs">
        hi
      </ChatMessage>,
    );
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("max-w-xs");
    expect(div.className).not.toContain("max-w-[90%]");
  });
});

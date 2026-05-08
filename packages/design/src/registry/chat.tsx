"use client";

import { forwardRef, useState, type ReactNode } from "react";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import { cn } from "../lib/cn";
import { ChatComposer } from "./chat-composer";
import { ChatMessage } from "./chat-message";
import { ChatMessageList } from "./chat-message-list";
import { ChatThinkingIndicator } from "./chat-thinking-indicator";
import { ToolCallList, type ToolCallListItem } from "./tool-call-list";
import type { ChatMessageRole } from "./chat-message";

/**
 * Chat — composite that wires the chat primitives together via plain UI props.
 *
 * Pure UI: state lives on the caller. Pass the canonical message list, the
 * in-flight streaming text/toolCalls, and a status; this component owns
 * scroll behavior and the streaming-bubble layout but knows nothing about
 * transport, presets, or persistence.
 *
 * Drop down to the parts (`<ChatMessageList>`, `<ChatMessage>`,
 * `<ChatComposer>`, `<ChatThinkingIndicator>`, `<ToolCallList>`,
 * `<ChatProgressBar>`) when you need a custom layout — e.g. a sidebar
 * preset picker, multiple panels, or non-standard composer behavior.
 */

export type ChatStatus = "idle" | "streaming" | "done" | "error";

export interface ChatMessageItem {
  id: string | number;
  role: ChatMessageRole;
  text: string;
  interrupted?: boolean;
  toolCalls?: ReadonlyArray<ToolCallListItem>;
}

export interface ChatRenderMarkdownOptions {
  streaming: boolean;
}

export type ChatRenderMarkdown = (
  text: string,
  options: ChatRenderMarkdownOptions,
) => ReactNode;

export interface ChatProps {
  messages: ReadonlyArray<ChatMessageItem>;
  streamingText?: string;
  streamingToolCalls?: ReadonlyArray<ToolCallListItem>;
  status: ChatStatus;
  onSend: (text: string) => void;
  onAbort?: () => void;
  /** Override the assistant Markdown renderer. Defaults to `<Streamdown>`. */
  renderMarkdown?: ChatRenderMarkdown;
  /** Slot rendered when there are no messages and no streaming content. */
  emptyState?: ReactNode;
  /** Slot rendered above the message list (e.g. preset picker, close button). */
  header?: ReactNode;
  composerPlaceholder?: string;
  className?: string;
}

export const defaultMarkdownRenderer: ChatRenderMarkdown = (
  text,
  { streaming },
) => (streaming ? (
  <Streamdown mode="streaming">{text}</Streamdown>
) : (
  <Streamdown>{text}</Streamdown>
));

export const Chat = forwardRef<HTMLDivElement, ChatProps>(function Chat(
  {
    messages,
    streamingText = "",
    streamingToolCalls = [],
    status,
    onSend,
    onAbort,
    renderMarkdown = defaultMarkdownRenderer,
    emptyState,
    header,
    composerPlaceholder,
    className,
  },
  ref,
) {
  const [input, setInput] = useState("");
  const isStreaming = status === "streaming";
  const isWaiting = isStreaming && !streamingText;

  // Drive anchored auto-scroll: bump on every new char of streaming text or
  // when the canonical message list grows.
  const streamSignal = `${messages.length}:${streamingText.length}:${streamingToolCalls.length}`;

  const isEmpty =
    messages.length === 0 &&
    streamingText.length === 0 &&
    streamingToolCalls.length === 0 &&
    !isWaiting;

  const handleSubmit = (text: string) => {
    setInput("");
    onSend(text);
  };

  return (
    <div
      ref={ref}
      className={cn("flex h-full flex-col bg-background", className)}
    >
      {header}
      <ChatMessageList
        streamSignal={streamSignal}
        isStreaming={isStreaming}
        isEmpty={isEmpty}
        emptyState={emptyState}
      >
        {messages.map((msg) => (
          <div key={msg.id}>
            <ChatMessage
              role={msg.role}
              {...(msg.interrupted ? { interrupted: true } : {})}
            >
              {msg.role === "assistant" ? (
                renderMarkdown(msg.text, { streaming: false })
              ) : (
                <p className="whitespace-pre-wrap">{msg.text}</p>
              )}
            </ChatMessage>
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="mt-1 max-w-[90%]">
                <ToolCallList items={msg.toolCalls} />
              </div>
            )}
          </div>
        ))}

        {isWaiting && <ChatThinkingIndicator />}

        {(streamingText || streamingToolCalls.length > 0) && (
          <div>
            {streamingText && (
              <ChatMessage role="assistant">
                {renderMarkdown(streamingText, { streaming: true })}
              </ChatMessage>
            )}
            {streamingToolCalls.length > 0 && (
              <div className="mt-1 max-w-[90%]">
                <ToolCallList items={streamingToolCalls} />
              </div>
            )}
          </div>
        )}
      </ChatMessageList>

      <ChatComposer
        value={input}
        onValueChange={setInput}
        onSubmit={handleSubmit}
        isStreaming={isStreaming}
        {...(onAbort ? { onAbort } : {})}
        {...(composerPlaceholder !== undefined
          ? { placeholder: composerPlaceholder }
          : {})}
      />
    </div>
  );
});

Chat.displayName = "Chat";

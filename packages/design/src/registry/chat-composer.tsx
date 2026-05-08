"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type FormEvent,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from "react";
import { Send, Square } from "lucide-react";
import { cn } from "../lib/cn";

/**
 * ChatComposer — textarea + send button (or stop button while streaming).
 *
 * Auto-resizes between `minHeight` and `maxHeight` as the user types. Submits
 * on Cmd/Ctrl+Enter (matching HomePage and the legacy sandbox/latex chats).
 * Plain Enter inserts a newline.
 *
 * State machine: when `isStreaming` is true, the send button is replaced by
 * a single "Stop generating" button that calls `onAbort`. This matches the
 * pattern in home/claude-chat.tsx.
 */

export interface ChatComposerProps
  extends Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "onSubmit" | "value" | "onChange"
  > {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  isStreaming?: boolean;
  onAbort?: () => void;
  /** Submit affordance label. Default "Send message". */
  sendLabel?: string;
  /** Stop affordance label. Default "Stop generating". */
  stopLabel?: string;
  minHeightPx?: number;
  maxHeightPx?: number;
}

export const ChatComposer = forwardRef<HTMLTextAreaElement, ChatComposerProps>(
  function ChatComposer(
    {
      value,
      onValueChange,
      onSubmit,
      isStreaming = false,
      onAbort,
      sendLabel = "Send message",
      stopLabel = "Stop generating",
      minHeightPx = 40,
      maxHeightPx = 200,
      placeholder = "Ask anything…",
      disabled,
      className,
      ...textareaProps
    },
    ref,
  ) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    useImperativeHandle(ref, () => textareaRef.current!, []);

    // Auto-resize between min and max.
    useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      const next = Math.max(
        minHeightPx,
        Math.min(el.scrollHeight, maxHeightPx),
      );
      el.style.height = `${next}px`;
    }, [value, minHeightPx, maxHeightPx]);

    const trimmed = value.trim();
    const canSubmit = !isStreaming && trimmed.length > 0 && !disabled;

    const submit = () => {
      if (!canSubmit) return;
      onSubmit(trimmed);
    };

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      submit();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submit();
      }
    };

    return (
      <form
        onSubmit={handleSubmit}
        className={cn(
          "flex items-end gap-2 border-t border-border bg-background px-3 py-2",
          className,
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isStreaming}
          rows={1}
          style={{ minHeight: minHeightPx, maxHeight: maxHeightPx }}
          className={cn(
            "flex-1 resize-none rounded-md border border-border bg-background px-2.5 py-1.5",
            "text-sm text-foreground placeholder:text-muted-foreground",
            "outline-none focus:border-ring focus:ring-2 focus:ring-ring/20",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
          {...textareaProps}
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onAbort}
            aria-label={stopLabel}
            title={stopLabel}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-md",
              "border border-border bg-background text-muted-foreground",
              "transition-colors hover:bg-muted hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            )}
          >
            <Square className="size-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSubmit}
            aria-label={sendLabel}
            title={sendLabel}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-md",
              "bg-primary text-primary-foreground",
              "transition-opacity hover:opacity-90",
              "disabled:cursor-not-allowed disabled:opacity-40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            )}
          >
            <Send className="size-4" />
          </button>
        )}
      </form>
    );
  },
);

ChatComposer.displayName = "ChatComposer";

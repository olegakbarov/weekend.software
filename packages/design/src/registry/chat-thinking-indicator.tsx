"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../lib/cn";

/**
 * ChatThinkingIndicator — three bouncing dots + optional label.
 *
 * Shown while the assistant has been called but no streaming text has arrived
 * yet. Lives inside the message list, styled like an assistant bubble so the
 * scroll layout doesn't shift when the first token lands.
 */

export interface ChatThinkingIndicatorProps
  extends HTMLAttributes<HTMLDivElement> {
  label?: string;
}

export const ChatThinkingIndicator = forwardRef<
  HTMLDivElement,
  ChatThinkingIndicatorProps
>(function ChatThinkingIndicator(
  { label = "Thinking…", className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className={cn(
        "flex max-w-[90%] items-center gap-2 rounded-lg bg-muted px-3 py-2",
        className,
      )}
      {...props}
    >
      <span className="flex items-center gap-1" aria-hidden>
        <Dot delay="0s" />
        <Dot delay="0.2s" />
        <Dot delay="0.4s" />
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
});

ChatThinkingIndicator.displayName = "ChatThinkingIndicator";

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
      style={{ animationDuration: "1.4s", animationDelay: delay }}
    />
  );
}

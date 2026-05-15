"use client";

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * ChatMessage — a single role-tagged bubble.
 *
 * User messages right-align with primary fill; assistant messages left-align
 * on the muted surface. Content is delegated to children, so callers choose
 * plain text, a Markdown renderer, or anything else.
 */

export type ChatMessageRole = "user" | "assistant";

export interface ChatMessageProps extends HTMLAttributes<HTMLDivElement> {
  role: ChatMessageRole;
  /** Show an "interrupted" footer (e.g. when a stream was aborted mid-message). */
  interrupted?: boolean;
  /** Override the bubble's max-width class. Default `max-w-[90%]`. */
  maxWidthClassName?: string;
}

export const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>(
  function ChatMessage(
    { role, interrupted, maxWidthClassName, className, children, ...props },
    ref,
  ) {
    const isUser = role === "user";
    return (
      <div
        ref={ref}
        data-role={role}
        className={cn(
          "rounded-lg px-3 py-2 text-sm leading-relaxed",
          maxWidthClassName ?? "max-w-[90%]",
          isUser
            ? "ml-auto bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
          className,
        )}
        {...props}
      >
        {children}
        {interrupted && (
          <p className="mt-1 text-[11px] italic text-muted-foreground">
            Interrupted
          </p>
        )}
      </div>
    );
  },
);

ChatMessage.displayName = "ChatMessage";

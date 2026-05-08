"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "../lib/cn";

/**
 * ChatMessageList — vertically scrolling container with anchored-bottom scroll.
 *
 * The list auto-scrolls to the latest message ONLY when the user is already
 * pinned to the bottom (within `pinThresholdPx`). If the user has scrolled up
 * to read history, incoming streaming text won't yank them back — they keep
 * reading until they scroll back down themselves.
 *
 * `streamSignal` is the dependency that drives auto-scroll. Pass any value
 * that changes as the stream advances (e.g. `streamingText`, message count,
 * tokens received). When `streamSignal` changes and the list is pinned, it
 * scrolls to the bottom; smooth when idle, instant during streaming for
 * responsiveness.
 */

export interface ChatMessageListHandle {
  /** Manually pin to bottom (e.g. after the user clicks a "jump to latest" button). */
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  /** True when the viewport is currently at (or within `pinThresholdPx` of) the bottom. */
  isPinnedToBottom: () => boolean;
}

export interface ChatMessageListProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children: ReactNode;
  /** Anything that changes as the stream advances; triggers anchored auto-scroll. */
  streamSignal?: unknown;
  /** Whether the most recent change was a streaming append (instant scroll vs smooth). */
  isStreaming?: boolean;
  /** Slot rendered when `isEmpty` is true. */
  emptyState?: ReactNode;
  /** Caller flag: render `emptyState` instead of children. */
  isEmpty?: boolean;
  /** Pixel slack from bottom that still counts as "pinned." Default 32. */
  pinThresholdPx?: number;
}

export const ChatMessageList = forwardRef<
  ChatMessageListHandle,
  ChatMessageListProps
>(function ChatMessageList(
  {
    children,
    streamSignal,
    isStreaming = false,
    emptyState,
    isEmpty = false,
    pinThresholdPx = 32,
    className,
    ...props
  },
  ref,
) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);

  const isPinnedToBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= pinThresholdPx;
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  useImperativeHandle(
    ref,
    () => ({ scrollToBottom, isPinnedToBottom }),
    [],
  );

  // Track pin state on user scroll.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      pinnedRef.current = isPinnedToBottom();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinThresholdPx]);

  // Auto-scroll when streamSignal advances, but only if pinned.
  useLayoutEffect(() => {
    if (!pinnedRef.current) return;
    scrollToBottom(isStreaming ? "instant" : "smooth");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamSignal, isStreaming]);

  return (
    <div
      ref={scrollRef}
      className={cn("flex-1 overflow-y-auto", className)}
      {...props}
    >
      {isEmpty && emptyState !== undefined ? (
        <div className="flex h-full items-center justify-center">
          {emptyState}
        </div>
      ) : (
        <div className="space-y-2 px-3 py-2">{children}</div>
      )}
    </div>
  );
});

ChatMessageList.displayName = "ChatMessageList";

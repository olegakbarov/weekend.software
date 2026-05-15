"use client";

import { forwardRef, useState, type HTMLAttributes } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";
import { springs } from "../lib/springs";
import { ToolCall, type ToolCallProps } from "./tool-call";

/**
 * ToolCallList — agent-stream pattern that keeps the live tool call in view
 * while collapsing prior calls under a "▸ N/M tool calls" summary.
 *
 * Pure UI: callers pass an `items` array shaped as ToolCall props (plus a
 * stable `id` for keying). The latest item renders inline; everything before
 * it tucks behind a single disclosure button.
 *
 * Pass each `ToolCall` directly (without a list) when you want every tool to
 * render flat — e.g. a logs page or trace viewer. This component is for the
 * specific chat-scrollback shape where the latest call matters most.
 */

export interface ToolCallListItem extends ToolCallProps {
  id: string;
}

export interface ToolCallListProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  items: readonly ToolCallListItem[];
  defaultSummaryOpen?: boolean;
}

function isCompleted(state: ToolCallProps["state"]): boolean {
  return state === "output-available" || state === "output-error";
}

export const ToolCallList = forwardRef<HTMLDivElement, ToolCallListProps>(
  function ToolCallList(
    { items, defaultSummaryOpen = false, className, ...props },
    ref,
  ) {
    const [expanded, setExpanded] = useState(defaultSummaryOpen);
    const shouldReduceMotion = useReducedMotion();

    if (items.length === 0) return null;

    const latest = items[items.length - 1]!;
    const previous = items.slice(0, -1);
    const completedCount = previous.filter((it) => isCompleted(it.state)).length;
    const previewNames = previous.map((it) => it.name).join(", ");

    return (
      <LazyMotion features={domAnimation}>
        <div ref={ref} className={cn("space-y-1", className)} {...props}>
        {previous.length > 0 && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((e) => !e)}
            className={cn(
              "flex w-full items-center gap-1.5 rounded-md px-1.5 py-0.5",
              "text-[11px] text-muted-foreground outline-none",
              "transition-colors hover:bg-muted/50 hover:text-foreground",
              "focus-visible:ring-2 focus-visible:ring-ring/50",
            )}
          >
            <m.span
              animate={{ rotate: expanded ? 90 : 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : springs.fast}
              className="inline-flex"
            >
              <ChevronRight className="size-3" />
            </m.span>
            <span className="font-mono tabular-nums">
              {completedCount}/{previous.length} tool calls
            </span>
            {!expanded && previewNames && (
              <span className="min-w-0 flex-1 truncate text-left opacity-60">
                {previewNames}
              </span>
            )}
          </button>
        )}

        <AnimatePresence initial={false}>
          {expanded && previous.length > 0 && (
            <m.div
              key="previous"
              initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { ...springs.moderate, bounce: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-1 pt-1">
                {previous.map(({ id, ...itemProps }) => (
                  <ToolCall key={id} {...itemProps} />
                ))}
              </div>
            </m.div>
          )}
        </AnimatePresence>

        <ToolCall key={latest.id} {...stripId(latest)} />
        </div>
      </LazyMotion>
    );
  },
);

ToolCallList.displayName = "ToolCallList";

function stripId({ id: _id, ...rest }: ToolCallListItem): ToolCallProps {
  return rest;
}

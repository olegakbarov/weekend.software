"use client";

import {
  forwardRef,
  isValidElement,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  Settings,
  XCircle,
} from "lucide-react";
import { cn } from "../lib/cn";
import { springs } from "../lib/springs";

/**
 * ToolCall — the canonical card for a single tool invocation in an agent stream.
 *
 * Originally lived in the `home` project as `src/components/ui/tool.tsx` driving
 * the Claude tool-use UI. Absorbed into @weekend/design so the chat block, the
 * logs view, and any agent-trace consumer can render the same primitive.
 *
 * State drives the icon, badge, and accent: input-streaming → primary spinner,
 * input-available → warning gear, output-available → success check,
 * output-error → destructive cross. The body is collapsible; if no input/
 * output/error/callId is supplied, the disclosure is suppressed.
 *
 * Slots accept either a ReactNode (rendered as-is) or a plain record (auto-
 * formatted as key:value rows). The pluggable shape lets callers bring their
 * own syntax-highlighted JSON renderer when they want one.
 */

export type ToolCallState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

export interface ToolCallProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  name: string;
  state: ToolCallState;
  defaultOpen?: boolean;
  callId?: string;
  input?: ReactNode | Record<string, unknown>;
  output?: ReactNode | Record<string, unknown>;
  errorText?: string;
}

const STATE_LABELS: Record<ToolCallState, string> = {
  "input-streaming": "Processing",
  "input-available": "Ready",
  "output-available": "Completed",
  "output-error": "Error",
};

const STATE_BADGE_CLASSES: Record<ToolCallState, string> = {
  "input-streaming": "bg-primary/10 text-primary",
  "input-available": "bg-warning/15 text-warning",
  "output-available": "bg-success/15 text-success",
  "output-error": "bg-destructive/15 text-destructive",
};

function StateIcon({ state }: { state: ToolCallState }) {
  switch (state) {
    case "input-streaming":
      return <Loader2 className="size-4 shrink-0 animate-spin text-primary" />;
    case "input-available":
      return <Settings className="size-4 shrink-0 text-warning" />;
    case "output-available":
      return <CheckCircle2 className="size-4 shrink-0 text-success" />;
    case "output-error":
      return <XCircle className="size-4 shrink-0 text-destructive" />;
  }
}

function formatScalar(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function RecordFields({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-1 rounded-md border border-border/60 bg-muted/40 p-2 font-mono text-xs">
      {Object.entries(data).map(([key, value]) => (
        <div key={key}>
          <span className="text-muted-foreground">{key}:</span>{" "}
          <span className="whitespace-pre-wrap break-words">
            {formatScalar(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function renderSlot(
  value: ReactNode | Record<string, unknown> | undefined,
): ReactNode {
  if (value == null) return null;
  if (isValidElement(value)) return value;
  if (
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const data = value as Record<string, unknown>;
    if (Object.keys(data).length === 0) return null;
    return <RecordFields data={data} />;
  }
  return value as ReactNode;
}

export const ToolCall = forwardRef<HTMLDivElement, ToolCallProps>(
  function ToolCall(
    {
      name,
      state,
      defaultOpen = false,
      callId,
      input,
      output,
      errorText,
      className,
      ...props
    },
    ref,
  ) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const shouldReduceMotion = useReducedMotion();
    const inputSlot = renderSlot(input);
    const outputSlot = renderSlot(output);
    const showError = state === "output-error" && Boolean(errorText);
    const hasBody = Boolean(inputSlot || outputSlot || showError || callId);

    return (
      <LazyMotion features={domAnimation}>
        <div
          ref={ref}
          data-state={state}
          className={cn(
            "overflow-hidden rounded-lg border border-border bg-background",
            className,
          )}
          {...props}
        >
        <button
          type="button"
          aria-expanded={hasBody ? isOpen : undefined}
          disabled={!hasBody}
          onClick={() => hasBody && setIsOpen((o) => !o)}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2 text-left outline-none",
            hasBody &&
              "cursor-pointer hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50",
            !hasBody && "cursor-default",
          )}
        >
          <StateIcon state={state} />
          <span className="flex-1 truncate font-mono text-sm font-medium text-foreground">
            {name}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium leading-none",
              STATE_BADGE_CLASSES[state],
            )}
          >
            {STATE_LABELS[state]}
          </span>
          {hasBody && (
            <m.span
              className="text-muted-foreground"
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : springs.fast}
            >
              <ChevronDown className="size-4" />
            </m.span>
          )}
        </button>

        <AnimatePresence initial={false}>
          {isOpen && hasBody && (
            <m.div
              key="body"
              initial={shouldReduceMotion ? false : { height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { ...springs.moderate, bounce: 0 }}
              className="overflow-hidden border-t border-border"
            >
              <div className="space-y-3 p-3">
                {inputSlot && (
                  <ToolCallSection label="Input">{inputSlot}</ToolCallSection>
                )}
                {outputSlot && (
                  <ToolCallSection label="Output">{outputSlot}</ToolCallSection>
                )}
                {showError && (
                  <div>
                    <h4 className="mb-1.5 text-xs font-medium text-destructive">
                      Error
                    </h4>
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 font-mono text-xs text-destructive">
                      {errorText}
                    </div>
                  </div>
                )}
                {callId && (
                  <div className="border-t border-border pt-2 font-mono text-[10px] text-muted-foreground">
                    Call ID: {callId}
                  </div>
                )}
              </div>
            </m.div>
          )}
        </AnimatePresence>
        </div>
      </LazyMotion>
    );
  },
);

ToolCall.displayName = "ToolCall";

function ToolCallSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">
        {label}
      </h4>
      {children}
    </div>
  );
}

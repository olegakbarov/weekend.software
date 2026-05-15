"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { cn } from "../lib/cn";

/**
 * ChatProgressBar — thin shimmer bar shown while a chat stream is in flight.
 *
 * Exported separately from `<Chat>` so consumers compose it where they want
 * (under the header, above the composer, etc.). Render conditionally based
 * on streaming state; this component does no internal logic.
 */

export interface ChatProgressBarProps extends HTMLAttributes<HTMLDivElement> {}

export const ChatProgressBar = forwardRef<HTMLDivElement, ChatProgressBarProps>(
  function ChatProgressBar({ className, ...props }, ref) {
    const shouldReduceMotion = useReducedMotion();

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-busy="true"
        className={cn(
          "h-0.5 w-full overflow-hidden bg-muted",
          className,
        )}
        {...props}
      >
        <LazyMotion features={domAnimation}>
          <m.div
            className="h-full w-1/3 rounded-full bg-primary/60"
            initial={shouldReduceMotion ? false : { x: "-100%" }}
            animate={shouldReduceMotion ? { x: "100%" } : { x: "300%" }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : {
                    duration: 1.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
            }
          />
        </LazyMotion>
      </div>
    );
  },
);

ChatProgressBar.displayName = "ChatProgressBar";

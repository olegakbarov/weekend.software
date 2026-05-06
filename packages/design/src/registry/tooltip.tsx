"use client";

import { type ReactNode } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "../lib/cn";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  delayDuration?: number;
  sideOffset?: number;
  /** Force open/closed for controlled scenarios. Undefined means uncontrolled. */
  forceOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

export function Tooltip({
  content,
  children,
  delayDuration = 300,
  sideOffset = 4,
  forceOpen,
  onOpenChange,
  side = "top",
  className,
}: TooltipProps): React.JSX.Element {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root
        {...(forceOpen !== undefined ? { open: forceOpen } : {})}
        {...(onOpenChange ? { onOpenChange } : {})}
      >
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={sideOffset}
            side={side}
            className={cn(
              "z-50 px-2 py-1 text-[12px] bg-foreground text-background",
              "rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.18)]",
              "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0",
              className,
            )}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

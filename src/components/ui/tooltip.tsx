import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 8, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      className={cn(
        "z-50 rounded border border-border bg-card px-2 py-1 font-medium text-[13px] text-foreground normal-case leading-snug tracking-normal shadow-lg backdrop-blur",
        "fade-in-0 zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 animate-in data-[state=closed]:animate-out",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      ref={ref}
      sideOffset={sideOffset}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow className="fill-card stroke-border" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));

TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent };

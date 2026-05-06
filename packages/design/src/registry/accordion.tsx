"use client";

import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
} from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";
import { fontWeights } from "../lib/font-weight";
import { springs } from "../lib/springs";
import { useShape } from "../lib/shape-context";

/**
 * Accordion — a simplified port wrapping Radix's accordion. The legacy version
 * adds proximity-hover overlays across grouped items; this port keeps the
 * Radix-correct ARIA + open/close machinery and the spring-based content
 * animation, but skips the proximity overlay layer.
 */

const Accordion = AccordionPrimitive.Root;

const AccordionItem = forwardRef<
  ElementRef<typeof AccordionPrimitive.Item>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => {
  const shape = useShape();
  return (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn(
        "relative overflow-hidden border border-border/60",
        "data-[state=open]:bg-muted/40",
        shape.container,
        className,
      )}
      {...props}
    />
  );
});
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = forwardRef<
  ElementRef<typeof AccordionPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "group flex flex-1 items-center justify-between w-full",
        "px-4 py-3 text-[13px] text-foreground text-left",
        "outline-none transition-colors duration-80",
        "hover:bg-hover focus-visible:ring-2 focus-visible:ring-[#6B97FF]",
        className,
      )}
      style={{ fontVariationSettings: fontWeights.medium }}
      {...props}
    >
      <span className="flex-1">{children}</span>
      <ChevronDown
        size={14}
        strokeWidth={1.5}
        className={cn(
          "shrink-0 ml-2 text-muted-foreground transition-transform duration-160",
          "group-data-[state=open]:rotate-180 group-data-[state=open]:text-foreground",
        )}
      />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = "AccordionTrigger";

const AccordionContent = forwardRef<
  ElementRef<typeof AccordionPrimitive.Content>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn("overflow-hidden", className)}
    {...props}
  >
    <AnimatePresence initial={false}>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={springs.moderate}
        className="px-4 pb-3 text-[13px] text-muted-foreground leading-relaxed"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = "AccordionContent";

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };

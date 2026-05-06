"use client";

import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
} from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../lib/cn";
import { fontWeights } from "../lib/font-weight";

/**
 * Tabs — a Radix Tabs wrapper with the design package's typography idiom.
 *
 * Visual convention: TabsList is a thin row with a bottom border; the active
 * trigger draws a 2px underline that overlaps the list border (via `-mb-px`).
 * This is the conventional Radix Tabs styling and reads as a "tabbed surface"
 * — distinct from `Seg`, which is a pill-style segmented control.
 *
 * Compound API matches Radix conventions:
 *   <Tabs defaultValue="a">
 *     <TabsList>
 *       <TabsTrigger value="a">A</TabsTrigger>
 *       <TabsTrigger value="b">B</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="a">…</TabsContent>
 *     <TabsContent value="b">…</TabsContent>
 *   </Tabs>
 */

const Tabs = TabsPrimitive.Root;

const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-start gap-1 border-b border-border/60",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    style={{ fontVariationSettings: fontWeights.medium }}
    className={cn(
      "relative inline-flex h-9 items-center px-3 -mb-px",
      "text-[13px] text-muted-foreground",
      "border-b-2 border-transparent",
      "transition-colors duration-80",
      "hover:text-foreground",
      "data-[state=active]:text-foreground data-[state=active]:border-foreground",
      "outline-none focus-visible:ring-2 focus-visible:ring-[#6B97FF]",
      "disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-3 outline-none focus-visible:ring-0", className)}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";

export { Tabs, TabsContent, TabsList, TabsTrigger };

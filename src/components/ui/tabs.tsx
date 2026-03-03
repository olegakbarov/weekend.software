import * as TabsPrimitive from "@radix-ui/react-tabs";
import type * as React from "react";
import { cn } from "@/lib/utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      className={cn("flex min-h-0 flex-col gap-2", className)}
      data-slot="tabs"
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex w-fit items-center justify-center rounded bg-muted p-0.5 text-muted-foreground/70",
        className
      )}
      data-slot="tabs-list"
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap rounded px-3 py-1.5 font-medium text-sm outline-none transition-all hover:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-70 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs",
        className
      )}
      data-slot="tabs-trigger"
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("flex min-h-0 flex-1 flex-col outline-none", className)}
      data-slot="tabs-content"
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };

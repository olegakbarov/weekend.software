import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

type SelectVariant = "sm" | "md";

const triggerSizeClasses: Record<SelectVariant, string> = {
  sm: "h-7 px-2 text-xs",
  md: "h-9 px-3 text-sm",
};

const iconSizeClasses: Record<SelectVariant, string> = {
  sm: "size-3",
  md: "size-4",
};

const SelectRoot = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & {
    variant?: SelectVariant;
  }
>(({ className, children, variant = "md", ...props }, ref) => (
  <SelectPrimitive.Trigger
    className={cn(
      "flex items-center gap-2 rounded border border-border bg-input text-foreground transition-colors",
      "overflow-hidden whitespace-nowrap",
      "outline-none focus-visible:ring-1 focus-visible:ring-ring",
      "data-[placeholder]:text-muted-foreground",
      "data-[disabled]:data-[disabled]:opacity-50",
      triggerSizeClasses[variant],
      className
    )}
    ref={ref}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown
        className={cn("text-muted-foreground", iconSizeClasses[variant])}
      />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(
  (
    { className, children, position = "popper", sideOffset = 4, ...props },
    ref
  ) => (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded border border-border bg-card font-vcr text-foreground shadow-md",
          "data-[state=closed]:animate-out data-[state=open]:animate-in",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
          "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        position={position}
        ref={ref}
        sideOffset={sideOffset}
        {...props}
      >
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
);
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    className={cn(
      "relative flex w-full select-none items-center rounded-sm py-1.5 pr-2 pl-8 text-xs outline-none transition-colors",
      "data-[highlighted]:bg-secondary data-[highlighted]:text-foreground",
      "data-[state=checked]:bg-secondary data-[state=checked]:text-foreground",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-3 w-3" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export interface SelectProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>,
    "children" | "value"
  > {
  variant?: SelectVariant;
  placeholder?: string;
  className?: string;
  children: React.ReactNode;
  value?: string | undefined;
}

const Select = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectProps
>(
  (
    { className, variant = "md", placeholder, children, value, ...props },
    ref
  ) => (
    <SelectRoot value={value ?? ""} {...props}>
      <SelectTrigger className={className} ref={ref} variant={variant}>
        <SelectValue className="min-w-0 truncate" placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </SelectRoot>
  )
);
Select.displayName = "Select";

export {
  Select,
  SelectRoot,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
};

import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { Check, ChevronRight, Circle } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const ContextMenu = ContextMenuPrimitive.Root;

const ContextMenuTrigger = ContextMenuPrimitive.Trigger;

const ContextMenuGroup = ContextMenuPrimitive.Group;

const ContextMenuPortal = ContextMenuPrimitive.Portal;

const ContextMenuSub = ContextMenuPrimitive.Sub;

const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

type ContextMenuSubTriggerProps = React.ComponentPropsWithoutRef<
  typeof ContextMenuPrimitive.SubTrigger
> & {
  inset?: boolean;
  ref?: React.Ref<React.ComponentRef<typeof ContextMenuPrimitive.SubTrigger>>;
};

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ref,
  ...props
}: ContextMenuSubTriggerProps) {
  return (
    <ContextMenuPrimitive.SubTrigger
      className={cn(
        "flex cursor-default select-none items-center rounded-sm px-2 py-1 text-xs outline-none transition-colors data-[highlighted]:bg-secondary data-[state=open]:bg-secondary data-[highlighted]:text-foreground data-[state=open]:text-foreground",
        inset && "pl-8",
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto size-3.5" />
    </ContextMenuPrimitive.SubTrigger>
  );
}
ContextMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName;

type ContextMenuSubContentProps = React.ComponentPropsWithoutRef<
  typeof ContextMenuPrimitive.SubContent
> & {
  ref?: React.Ref<React.ComponentRef<typeof ContextMenuPrimitive.SubContent>>;
};

function ContextMenuSubContent({
  className,
  ref,
  ...props
}: ContextMenuSubContentProps) {
  return (
    <ContextMenuPrimitive.SubContent
      className={cn(
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-auto truncate rounded-md border border-border bg-card p-1 font-vcr text-foreground shadow-md data-[state=closed]:animate-out data-[state=open]:animate-in",
        className
      )}
      ref={ref}
      {...props}
    />
  );
}
ContextMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName;

type ContextMenuContentProps = React.ComponentPropsWithoutRef<
  typeof ContextMenuPrimitive.Content
> & {
  ref?: React.Ref<React.ComponentRef<typeof ContextMenuPrimitive.Content>>;
};

function ContextMenuContent({ className, ref, ...props }: ContextMenuContentProps) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        className={cn(
          "fade-in-80 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-auto animate-in truncate rounded-md border border-border bg-card p-1 font-vcr text-foreground shadow-md data-[state=closed]:animate-out data-[state=open]:animate-in",
          className
        )}
        ref={ref}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName;

type ContextMenuItemProps = React.ComponentPropsWithoutRef<
  typeof ContextMenuPrimitive.Item
> & {
  inset?: boolean;
  ref?: React.Ref<React.ComponentRef<typeof ContextMenuPrimitive.Item>>;
};

function ContextMenuItem({ className, inset, ref, ...props }: ContextMenuItemProps) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1 text-xs outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-secondary data-[disabled]:opacity-50",
        inset && "pl-8",
        className
      )}
      ref={ref}
      {...props}
    />
  );
}
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName;

type ContextMenuCheckboxItemProps = React.ComponentPropsWithoutRef<
  typeof ContextMenuPrimitive.CheckboxItem
> & {
  ref?: React.Ref<React.ComponentRef<typeof ContextMenuPrimitive.CheckboxItem>>;
};

function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  ref,
  ...props
}: ContextMenuCheckboxItemProps) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      checked={checked ?? false}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm py-1 pr-2 pl-8 text-xs outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <Check className="size-3.5" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  );
}
ContextMenuCheckboxItem.displayName =
  ContextMenuPrimitive.CheckboxItem.displayName;

type ContextMenuRadioItemProps = React.ComponentPropsWithoutRef<
  typeof ContextMenuPrimitive.RadioItem
> & {
  ref?: React.Ref<React.ComponentRef<typeof ContextMenuPrimitive.RadioItem>>;
};

function ContextMenuRadioItem({
  className,
  children,
  ref,
  ...props
}: ContextMenuRadioItemProps) {
  return (
    <ContextMenuPrimitive.RadioItem
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm py-1 pr-2 pl-8 text-xs outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <Circle className="size-2 fill-current" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  );
}
ContextMenuRadioItem.displayName = ContextMenuPrimitive.RadioItem.displayName;

type ContextMenuLabelProps = React.ComponentPropsWithoutRef<
  typeof ContextMenuPrimitive.Label
> & {
  inset?: boolean;
  ref?: React.Ref<React.ComponentRef<typeof ContextMenuPrimitive.Label>>;
};

function ContextMenuLabel({ className, inset, ref, ...props }: ContextMenuLabelProps) {
  return (
    <ContextMenuPrimitive.Label
      className={cn(
        "px-2 py-1.5 font-vcr text-muted-foreground text-xs",
        inset && "pl-8",
        className
      )}
      ref={ref}
      {...props}
    />
  );
}
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName;

type ContextMenuSeparatorProps = React.ComponentPropsWithoutRef<
  typeof ContextMenuPrimitive.Separator
> & {
  ref?: React.Ref<React.ComponentRef<typeof ContextMenuPrimitive.Separator>>;
};

function ContextMenuSeparator({
  className,
  ref,
  ...props
}: ContextMenuSeparatorProps) {
  return (
    <ContextMenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      ref={ref}
      {...props}
    />
  );
}
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName;

const ContextMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        "ml-auto text-muted-foreground text-xs tracking-widest",
        className
      )}
      {...props}
    />
  );
};
ContextMenuShortcut.displayName = "ContextMenuShortcut";

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
};

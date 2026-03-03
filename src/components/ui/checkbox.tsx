"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

type CheckboxProps = Omit<
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
  "checked" | "defaultChecked" | "onCheckedChange"
> & {
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: "sm" | "md";
};

function Checkbox({
  className,
  checked,
  defaultChecked,
  indeterminate,
  onCheckedChange,
  size = "md",
  ...props
}: CheckboxProps) {
  const resolvedChecked = indeterminate === true ? "indeterminate" : checked;
  const resolvedDefaultChecked =
    indeterminate === true ? "indeterminate" : defaultChecked;
  const rootSizeClass = size === "sm" ? "size-4" : "size-4.5";
  const iconSizeClass = size === "sm" ? "size-3" : "size-3.5";

  return (
    <CheckboxPrimitive.Root
      checked={resolvedChecked ?? false}
      className={cn(
        "group relative inline-flex shrink-0 items-center justify-center rounded-[4px] border border-input bg-background shadow-xs/5 outline-none ring-ring transition-shadow focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background data-[state=checked]:border-foreground/50 data-[state=indeterminate]:border-foreground/50 data-[state=checked]:bg-foreground/15 data-[state=indeterminate]:bg-foreground/15 data-[disabled]:opacity-64",
        rootSizeClass,
        className
      )}
      data-slot="checkbox"
      defaultChecked={resolvedDefaultChecked ?? false}
      onCheckedChange={(value) => onCheckedChange?.(value === true)}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="absolute -inset-px flex items-center justify-center rounded-[4px] text-foreground"
        data-slot="checkbox-indicator"
      >
        <svg
          className={cn(
            "hidden group-data-[state=checked]:block",
            iconSizeClass
          )}
          fill="none"
          height="24"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
          viewBox="0 0 24 24"
          width="24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M5.252 12.7 10.2 18.63 18.748 5.37" />
        </svg>
        <svg
          className={cn(
            "hidden group-data-[state=indeterminate]:block",
            iconSizeClass
          )}
          fill="none"
          height="24"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
          viewBox="0 0 24 24"
          width="24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M5.252 12h13.496" />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };

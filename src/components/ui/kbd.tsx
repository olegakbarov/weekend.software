import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const kbdVariants = cva(
  "inline-flex items-center justify-center rounded border border-border bg-background font-vcr",
  {
    variants: {
      size: {
        xs: "px-1 py-0.5 text-[12px]",
        sm: "px-1.5 py-0.5 text-xs",
        md: "px-2 py-1 text-sm",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  }
);

export interface KbdProps
  extends HTMLAttributes<HTMLElement>,
    VariantProps<typeof kbdVariants> {}

function Kbd({ className, size, ...props }: KbdProps) {
  return <kbd className={cn(kbdVariants({ size }), className)} {...props} />;
}

export { Kbd, kbdVariants };

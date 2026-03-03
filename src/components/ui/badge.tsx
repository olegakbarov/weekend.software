import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 font-medium text-xs transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/20 text-primary",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive/20 text-destructive",
        outline: "border border-border text-foreground",
        success: "bg-success/20 text-success",
        warning: "bg-warning/20 text-warning",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

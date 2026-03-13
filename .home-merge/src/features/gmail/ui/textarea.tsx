import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "~/lib/utils";

export interface GmailTextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const GmailTextarea = forwardRef<HTMLTextAreaElement, GmailTextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "min-h-24 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-[color,box-shadow]",
          "placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
GmailTextarea.displayName = "GmailTextarea";

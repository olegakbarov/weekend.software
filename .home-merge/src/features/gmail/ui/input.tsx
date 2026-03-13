import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "~/lib/utils";

export interface GmailInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const GmailInput = forwardRef<HTMLInputElement, GmailInputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        className={cn(
          "flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-[color,box-shadow] outline-none placeholder:text-muted-foreground/70",
          "focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        spellCheck={false}
        type={type}
        {...props}
      />
    );
  }
);
GmailInput.displayName = "GmailInput";

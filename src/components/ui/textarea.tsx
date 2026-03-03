import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: "default" | "ghost";
}

const textareaVariants = {
  default:
    "rounded-xl border border-border/60 bg-transparent focus-visible:border-border",
  ghost: "rounded bg-transparent focus:outline-none",
} as const;

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <textarea
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        className={cn(
          "flex min-h-[80px] w-full resize-none px-3 py-2 text-sm leading-relaxed transition-colors",
          "[overflow-wrap:anywhere]",
          "[word-break:break-word]",
          "placeholder:text-muted-foreground/50",
          "outline-none",
          "disabled:opacity-50",
          textareaVariants[variant],
          className
        )}
        ref={ref}
        spellCheck={false}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };

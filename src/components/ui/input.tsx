import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "ghost";
}

const inputVariants = {
  default:
    "rounded-xl border border-border/60 bg-transparent focus-visible:border-border",
  ghost: "rounded bg-transparent focus:outline-none",
} as const;

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = "default", ...props }, ref) => {
    return (
      <input
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        className={cn(
          "flex h-9 w-full px-3 py-1 text-sm transition-colors",
          "placeholder:text-muted-foreground/50",
          "outline-none",
          "disabled:opacity-50",
          inputVariants[variant],
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
Input.displayName = "Input";

export { Input };

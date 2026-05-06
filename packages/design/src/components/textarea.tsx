import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "../lib/cn";
import "./textarea.css";

export type TextareaVariant = "default" | "ghost";

export interface TextareaProps extends ComponentPropsWithoutRef<"textarea"> {
  variant?: TextareaVariant;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { variant = "default", className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      autoCapitalize="off"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      className={cn(
        "ds-textarea",
        variant !== "default" && `ds-textarea-${variant}`,
        className,
      )}
      {...props}
    />
  );
});

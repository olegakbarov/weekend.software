/**
 * FeatureInput - Composable input shell for rich task inputs.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface FeatureInputRootProps
  extends React.HTMLAttributes<HTMLDivElement> {
  tone?: "default" | "floating";
}

const FeatureInputRoot = React.forwardRef<
  HTMLDivElement,
  FeatureInputRootProps
>(({ className, tone = "default", ...props }, ref) => (
  <div
    className={cn(
      "overflow-hidden rounded-xl border border-border/60 bg-[color:var(--feature-input-bg)] text-foreground",
      tone === "floating" && "shadow-lg backdrop-blur-sm",
      className
    )}
    ref={ref}
    {...props}
  />
));
FeatureInputRoot.displayName = "FeatureInputRoot";

export interface FeatureInputHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const FeatureInputHeader = React.forwardRef<
  HTMLDivElement,
  FeatureInputHeaderProps
>(({ className, ...props }, ref) => (
  <div
    className={cn(
      "flex h-12 shrink-0 items-center border-border/60 border-b px-2",
      className
    )}
    ref={ref}
    {...props}
  />
));
FeatureInputHeader.displayName = "FeatureInputHeader";

export interface FeatureInputBodyProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const FeatureInputBody = React.forwardRef<
  HTMLDivElement,
  FeatureInputBodyProps
>(({ className, ...props }, ref) => (
  <div
    className={cn(
      "relative bg-[color:var(--feature-input-body-bg)]",
      className
    )}
    ref={ref}
    {...props}
  />
));
FeatureInputBody.displayName = "FeatureInputBody";

export interface FeatureInputFooterProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const FeatureInputFooter = React.forwardRef<
  HTMLDivElement,
  FeatureInputFooterProps
>(({ className, ...props }, ref) => (
  <div
    className={cn("border-border/60 border-t px-4 py-3", className)}
    ref={ref}
    {...props}
  />
));
FeatureInputFooter.displayName = "FeatureInputFooter";

export interface FeatureInputSelectTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const FeatureInputSelectTrigger = React.forwardRef<
  HTMLButtonElement,
  FeatureInputSelectTriggerProps
>(({ className, ...props }, ref) => (
  <button
    className={cn(
      "flex items-center gap-2 rounded",
      "bg-transparent px-2 font-vcr text-[13.5px] text-foreground/80",
      "transition-colors hover:bg-secondary/40 hover:text-foreground",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      "disabled:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  />
));
FeatureInputSelectTrigger.displayName = "FeatureInputSelectTrigger";

export interface FeatureInputTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoGrowValue?: string;
  containerClassName?: string;
}

const FeatureInputTextarea = React.forwardRef<
  HTMLTextAreaElement,
  FeatureInputTextareaProps
>(({ autoGrowValue, className, containerClassName, ...props }, ref) => {
  const baseClasses = cn(
    "w-full resize-none bg-transparent",
    "font-mono text-sm leading-relaxed",
    "wrap-anywhere [word-break:break-word]",
    "placeholder:text-muted-foreground/50",
    "outline-none",
    className
  );

  if (autoGrowValue !== undefined) {
    return (
      <div
        className={cn("w-full grow-wrap", containerClassName)}
        data-replicated-value={autoGrowValue}
      >
        <textarea
          autoCapitalize="off"
          autoCorrect="off"
          className={baseClasses}
          ref={ref}
          spellCheck={false}
          {...props}
        />
      </div>
    );
  }

  return (
    <textarea
      autoCapitalize="off"
      autoCorrect="off"
      className={baseClasses}
      ref={ref}
      spellCheck={false}
      {...props}
    />
  );
});
FeatureInputTextarea.displayName = "FeatureInputTextarea";

export const FeatureInput = {
  Root: FeatureInputRoot,
  Header: FeatureInputHeader,
  Body: FeatureInputBody,
  Footer: FeatureInputFooter,
  SelectTrigger: FeatureInputSelectTrigger,
  Textarea: FeatureInputTextarea,
};

export {
  FeatureInputRoot,
  FeatureInputHeader,
  FeatureInputBody,
  FeatureInputFooter,
  FeatureInputSelectTrigger,
  FeatureInputTextarea,
};

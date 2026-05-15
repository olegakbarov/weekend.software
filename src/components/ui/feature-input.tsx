/**
 * FeatureInput - Composable input shell for rich task inputs.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface FeatureInputRootProps
  extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
  tone?: "default" | "floating";
}

function FeatureInputRoot({
  className,
  ref,
  tone = "default",
  ...props
}: FeatureInputRootProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/60 bg-[color:var(--feature-input-bg)] text-foreground",
        tone === "floating" && "shadow-lg backdrop-blur-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  );
}
FeatureInputRoot.displayName = "FeatureInputRoot";

export interface FeatureInputHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

function FeatureInputHeader({ className, ref, ...props }: FeatureInputHeaderProps) {
  return (
    <div
      className={cn(
        "flex h-12 shrink-0 items-center border-border/60 border-b px-2",
        className
      )}
      ref={ref}
      {...props}
    />
  );
}
FeatureInputHeader.displayName = "FeatureInputHeader";

export interface FeatureInputBodyProps
  extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

function FeatureInputBody({ className, ref, ...props }: FeatureInputBodyProps) {
  return (
    <div
      className={cn(
        "relative bg-[color:var(--feature-input-body-bg)]",
        className
      )}
      ref={ref}
      {...props}
    />
  );
}
FeatureInputBody.displayName = "FeatureInputBody";

export interface FeatureInputFooterProps
  extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

function FeatureInputFooter({ className, ref, ...props }: FeatureInputFooterProps) {
  return (
    <div
      className={cn("border-border/60 border-t px-4 py-3", className)}
      ref={ref}
      {...props}
    />
  );
}
FeatureInputFooter.displayName = "FeatureInputFooter";

export interface FeatureInputSelectTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: React.Ref<HTMLButtonElement>;
}

function FeatureInputSelectTrigger({
  className,
  ref,
  ...props
}: FeatureInputSelectTriggerProps) {
  return (
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
  );
}
FeatureInputSelectTrigger.displayName = "FeatureInputSelectTrigger";

export interface FeatureInputTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoGrowValue?: string;
  containerClassName?: string;
  ref?: React.Ref<HTMLTextAreaElement>;
}

function FeatureInputTextarea({
  autoGrowValue,
  className,
  containerClassName,
  ref,
  ...props
}: FeatureInputTextareaProps) {
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
}
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

"use client";

import { type HTMLAttributes, type ReactNode, forwardRef } from "react";
import { motion } from "framer-motion";
import { cn } from "../lib/cn";
import { fontWeights } from "../lib/font-weight";
import { springs } from "../lib/springs";
import { useShape } from "../lib/shape-context";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion";
import { Badge, type BadgeColor } from "./badge";

interface ThinkingStepsProps extends HTMLAttributes<HTMLDivElement> {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

const ThinkingSteps = forwardRef<HTMLDivElement, ThinkingStepsProps>(
  (
    { defaultOpen = true, open, onOpenChange, children, className, ...props },
    ref,
  ) => {
    const isControlled = open !== undefined;
    const accordionProps: { value?: string; defaultValue?: string; onValueChange?: (v: string) => void } =
      isControlled
        ? { value: open ? "thinking" : "" }
        : { defaultValue: defaultOpen ? "thinking" : "" };
    if (onOpenChange) {
      accordionProps.onValueChange = (v: string) => onOpenChange(v === "thinking");
    }

    return (
      <div ref={ref} className={cn("w-80 max-w-full", className)} {...props}>
        <Accordion type="single" collapsible {...accordionProps}>
          <AccordionItem value="thinking">{children}</AccordionItem>
        </Accordion>
      </div>
    );
  },
);
ThinkingSteps.displayName = "ThinkingSteps";

interface ThinkingStepsHeaderProps extends HTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
}

const ThinkingStepsHeader = forwardRef<HTMLButtonElement, ThinkingStepsHeaderProps>(
  ({ children = "Thinking", className, ...props }, ref) => (
    <AccordionTrigger ref={ref} className={cn("w-full", className)} {...props}>
      {children}
    </AccordionTrigger>
  ),
);
ThinkingStepsHeader.displayName = "ThinkingStepsHeader";

interface ThinkingStepsContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const ThinkingStepsContent = forwardRef<HTMLDivElement, ThinkingStepsContentProps>(
  ({ children, className, ...props }, ref) => (
    <AccordionContent>
      <div ref={ref} className={cn("flex flex-col", className)} {...props}>
        {children}
      </div>
    </AccordionContent>
  ),
);
ThinkingStepsContent.displayName = "ThinkingStepsContent";

type StepStatus = "complete" | "active" | "pending";

interface ThinkingStepProps {
  label: string;
  description?: string;
  status?: StepStatus;
  isLast?: boolean;
  children?: ReactNode;
  className?: string;
}

function ThinkingStep({
  label,
  description,
  status = "complete",
  isLast = false,
  children,
  className,
}: ThinkingStepProps): React.JSX.Element | null {
  const shape = useShape();
  if (status === "pending") return null;
  const isActive = status === "active";

  return (
    <motion.div
      className={cn("relative z-10 overflow-hidden", className)}
      initial={{ height: 0 }}
      animate={{ height: "auto" }}
      transition={springs.slow}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.24, delay: 0.08, ease: "easeOut" }}
      >
        <div className={cn("flex gap-2.5 px-2 py-1.5", shape.item)}>
          <div className="flex flex-col items-center shrink-0 w-[14px]">
            <div className="pt-0.5">
              <div className="w-[14px] h-[14px] flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
              </div>
            </div>
            {!isLast && <div className="flex-1 w-px bg-border/60 mt-1" />}
          </div>
          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <span
              className="text-[13px] leading-tight text-foreground"
              style={{ fontVariationSettings: fontWeights.medium }}
            >
              {label}
              {isActive && "…"}
            </span>
            {description && (
              <span className="text-[13px] text-muted-foreground leading-snug">
                {description}
              </span>
            )}
            {children}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

interface ThinkingStepSourceProps {
  color?: BadgeColor;
  children: ReactNode;
  className?: string;
}

function ThinkingStepSource({
  color = "gray",
  children,
  className,
}: ThinkingStepSourceProps): React.JSX.Element {
  return (
    <Badge variant="solid" size="sm" color={color} className={className}>
      {children}
    </Badge>
  );
}

interface ThinkingStepSourcesProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const ThinkingStepSources = forwardRef<HTMLDivElement, ThinkingStepSourcesProps>(
  ({ children, className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-wrap gap-1.5 mt-1", className)} {...props}>
      {children}
    </div>
  ),
);
ThinkingStepSources.displayName = "ThinkingStepSources";

export {
  ThinkingStep,
  ThinkingStepSource,
  ThinkingStepSources,
  ThinkingSteps,
  ThinkingStepsContent,
  ThinkingStepsHeader,
};
export type {
  StepStatus,
  ThinkingStepProps,
  ThinkingStepSourceProps,
  ThinkingStepSourcesProps,
  ThinkingStepsContentProps,
  ThinkingStepsHeaderProps,
  ThinkingStepsProps,
};

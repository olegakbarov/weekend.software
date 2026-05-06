"use client";

import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { motion } from "framer-motion";
import { cn } from "../lib/cn";
import { fontWeights } from "../lib/font-weight";
import { springs } from "../lib/springs";
import { useShape } from "../lib/shape-context";
import { useIcon, type AnyIconName, type IconName } from "../lib/icon-context";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion";
import { Badge, type BadgeColor } from "./badge";

// ─── ThinkingSteps (root) ───────────────────────────────────────────────────

interface ThinkingStepsProps extends HTMLAttributes<HTMLDivElement> {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

const ThinkingSteps = forwardRef<HTMLDivElement, ThinkingStepsProps>(
  function ThinkingSteps(
    {
      defaultOpen = true,
      open,
      onOpenChange,
      children,
      className,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      defaultValue: _defaultValue,
      ...props
    },
    ref,
  ) {
    const controlled = open !== undefined;
    const valueProps = controlled
      ? { value: open ? "thinking" : "" }
      : { defaultValue: defaultOpen ? "thinking" : "" };
    const handleValueChange = onOpenChange
      ? (v: string) => onOpenChange(v === "thinking")
      : undefined;
    return (
      <Accordion
        ref={ref}
        type="single"
        collapsible
        {...valueProps}
        {...(handleValueChange ? { onValueChange: handleValueChange } : {})}
        className={cn("w-80 max-w-full", className)}
        {...props}
      >
        {/* Hide standalone accordion expanded bg */}
        <AccordionItem value="thinking" className="[&>.absolute]:hidden">
          {children}
        </AccordionItem>
      </Accordion>
    );
  },
);
ThinkingSteps.displayName = "ThinkingSteps";

// ─── ThinkingStepsHeader ────────────────────────────────────────────────────

interface ThinkingStepsHeaderProps extends HTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
}

const ThinkingStepsHeader = forwardRef<
  HTMLButtonElement,
  ThinkingStepsHeaderProps
>(function ThinkingStepsHeader({ children = "Thinking", className, ...props }, ref) {
  return (
    <div className="w-fit">
      <AccordionTrigger
        ref={ref}
        className={cn("[&>span:first-child]:flex-none w-auto", className)}
        {...props}
      >
        {children}
      </AccordionTrigger>
    </div>
  );
});
ThinkingStepsHeader.displayName = "ThinkingStepsHeader";

// ─── ThinkingStepsContent ───────────────────────────────────────────────────

interface ThinkingStepsContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const ThinkingStepsContent = forwardRef<
  HTMLDivElement,
  ThinkingStepsContentProps
>(function ThinkingStepsContent({ children, className, ...props }, ref) {
  return (
    <AccordionContent>
      <div
        ref={ref}
        className={cn("flex flex-col", className)}
        {...props}
      >
        {children}
      </div>
    </AccordionContent>
  );
});
ThinkingStepsContent.displayName = "ThinkingStepsContent";

// ─── ThinkingStep ───────────────────────────────────────────────────────────

type StepStatus = "complete" | "active" | "pending";

interface ThinkingStepProps {
  /** Optional icon name resolved through icon-context. Defaults to `"dot"`. */
  icon?: AnyIconName;
  /** When false, renders a small dot indicator instead of an icon. */
  showIcon?: boolean;
  label: string;
  description?: string;
  status?: StepStatus;
  /**
   * Optional positional index — kept for upstream parity (proximity ordering).
   * Optional in our package to preserve back-compat with existing consumers
   * that don't thread an index.
   */
  index?: number;
  /** Stagger delay for the per-step appear animation. */
  delay?: number;
  isLast?: boolean;
  children?: ReactNode;
  className?: string;
}

function ThinkingStep({
  icon = "dot" as IconName,
  showIcon = true,
  label,
  description,
  status = "complete",
  isLast = false,
  children,
  className,
}: ThinkingStepProps): React.JSX.Element | null {
  const Icon = useIcon(icon);
  const shape = useShape();

  if (status === "pending") return null;

  const isActive = status === "active";

  return (
    /* Outer: animates height to create space smoothly */
    <motion.div
      className={cn("relative z-10 overflow-hidden", className)}
      initial={{ height: 0 }}
      animate={{ height: "auto" }}
      transition={springs.slow}
    >
      {/* Inner: fades content in after space starts opening */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.24, delay: 0.08, ease: "easeOut" }}
      >
        {/* Content row — this is the proximity hover target */}
        <div className={cn("flex gap-2.5 px-2 py-1.5", shape.item)}>
          {/* Icon column with continuous connector line */}
          <div className="flex flex-col items-center shrink-0 w-[14px]">
            <div className="pt-0.5">
              {showIcon ? (
                <Icon
                  size={14}
                  strokeWidth={1.5}
                  className="text-muted-foreground"
                />
              ) : (
                <div className="w-[14px] h-[14px] flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                </div>
              )}
            </div>
            {/* Line stretches from icon to bottom of this step */}
            {!isLast && <div className="flex-1 w-px bg-border/60 mt-1" />}
          </div>

          {/* Text content */}
          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <span
              className={cn(
                "text-[13px] leading-tight text-foreground",
                isActive && "shimmer-text",
              )}
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

// ─── ThinkingStepDetails (nested accordion) ────────────────────────────────

interface ThinkingStepDetailsProps {
  summary: string;
  details?: string[];
  defaultOpen?: boolean;
  children?: ReactNode;
  className?: string;
}

function ThinkingStepDetails({
  summary,
  details,
  defaultOpen = false,
  children,
  className,
}: ThinkingStepDetailsProps): React.JSX.Element {
  const shape = useShape();

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen ? "details" : ""}
      className={cn("mt-1 -ml-3", className)}
    >
      <AccordionItem value="details" className="[&>.absolute]:hidden">
        <div className="w-fit">
          <AccordionTrigger
            className={cn(
              "[&>span:first-child]:flex-none w-auto py-1 px-3 gap-1.5",
              shape.item,
            )}
          >
            {summary}
          </AccordionTrigger>
        </div>
        <AccordionContent>
          <div className="flex flex-col gap-0.5 pt-0.5">
            {details?.map((item, i) => (
              <span
                key={i}
                className="text-[12px] text-muted-foreground leading-snug"
              >
                {item}
              </span>
            ))}
            {children}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

// ─── ThinkingStepSources ────────────────────────────────────────────────────

interface ThinkingStepSourcesProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const ThinkingStepSources = forwardRef<
  HTMLDivElement,
  ThinkingStepSourcesProps
>(function ThinkingStepSources({ children, className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn("flex flex-wrap gap-1.5 mt-1", className)}
      {...props}
    >
      {children}
    </div>
  );
});
ThinkingStepSources.displayName = "ThinkingStepSources";

// ─── ThinkingStepSource ─────────────────────────────────────────────────────

interface ThinkingStepSourceProps {
  color?: BadgeColor;
  /** Stagger delay for the appear animation. */
  delay?: number;
  children: ReactNode;
  className?: string;
}

function ThinkingStepSource({
  color = "gray",
  delay = 0,
  children,
  className,
}: ThinkingStepSourceProps): React.JSX.Element {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85, filter: "blur(4px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{
        ...springs.moderate,
        delay,
        filter: { duration: 0.12, delay },
      }}
    >
      <Badge variant="solid" size="sm" color={color} className={className}>
        {children}
      </Badge>
    </motion.span>
  );
}

// ─── ThinkingStepImage ──────────────────────────────────────────────────────

interface ThinkingStepImageProps {
  src: string;
  alt?: string;
  caption?: string;
  delay?: number;
  className?: string;
}

function ThinkingStepImage({
  src,
  alt = "",
  caption,
  delay = 0,
  className,
}: ThinkingStepImageProps): React.JSX.Element {
  const shape = useShape();
  return (
    <motion.div
      className={cn("mt-1.5", className)}
      initial={{ opacity: 0, filter: "blur(4px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      transition={{
        opacity: { duration: 0.2, delay, ease: "easeOut" },
        filter: { duration: 0.15, delay },
      }}
    >
      <img
        src={src}
        alt={alt}
        className={cn("w-full max-w-[200px] object-cover", shape.container)}
      />
      {caption && (
        <span className="text-[11px] text-muted-foreground mt-1 block">
          {caption}
        </span>
      )}
    </motion.div>
  );
}

// ─── Exports ────────────────────────────────────────────────────────────────

export {
  ThinkingStep,
  ThinkingStepDetails,
  ThinkingStepImage,
  ThinkingStepSource,
  ThinkingStepSources,
  ThinkingSteps,
  ThinkingStepsContent,
  ThinkingStepsHeader,
};
export type {
  StepStatus,
  ThinkingStepDetailsProps,
  ThinkingStepImageProps,
  ThinkingStepProps,
  ThinkingStepSourceProps,
  ThinkingStepSourcesProps,
  ThinkingStepsContentProps,
  ThinkingStepsHeaderProps,
  ThinkingStepsProps,
};

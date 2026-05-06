"use client";

import {
  type HTMLAttributes,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../lib/cn";
import { fontWeights } from "../lib/font-weight";
import { useIcon } from "../lib/icon-context";
import { useShape } from "../lib/shape-context";
import { springs } from "../lib/springs";
import { Tooltip } from "./tooltip";

type InputCopyVariant = "icon" | "button";
type InputCopyAlign = "right" | "left";

interface InputCopyProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  value: string;
  label?: string;
  onCopy?: () => void;
  disabled?: boolean;
  variant?: InputCopyVariant;
  align?: InputCopyAlign;
}

const InputCopy = forwardRef<HTMLDivElement, InputCopyProps>(
  (
    {
      value,
      label,
      onCopy,
      disabled,
      variant = "icon",
      align = "right",
      className,
      ...props
    },
    ref,
  ) => {
    const CopyIcon = useIcon("copy");
    const [copied, setCopied] = useState(false);
    const [copyCount, setCopyCount] = useState(0);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const shape = useShape();

    const handleCopy = useCallback(async (): Promise<void> => {
      if (disabled || !navigator.clipboard) return;
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setCopyCount((c) => c + 1);
        onCopy?.();
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard API not available — fail silently.
      }
    }, [value, disabled, onCopy]);

    useEffect(() => {
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }, []);

    const iconNode = (
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key={`check-${copyCount}`}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={springs.fast}
            className="flex items-center justify-center"
          >
            <svg
              width={14}
              height={14}
              viewBox="2 4 20 16"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <motion.path
                d="M6 12L10 16L18 8"
                initial={{ pathLength: 0 }}
                animate={{
                  pathLength: 1,
                  transition: { duration: 0.08, ease: "easeOut" },
                }}
                strokeWidth={2}
              />
            </svg>
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={springs.fast}
            className="flex items-center justify-center"
          >
            <CopyIcon
              size={14}
              strokeWidth={1.5}
              className="transition-[stroke-width] duration-80 group-hover:stroke-[2]"
            />
          </motion.span>
        )}
      </AnimatePresence>
    );

    const actionElement =
      variant === "button" ? (
        <span
          className={cn(
            "shrink-0 flex items-center gap-1.5 px-1.5 py-2 text-[13px]",
            "transition-colors duration-80 text-muted-foreground group-hover:text-foreground",
          )}
          style={{ fontVariationSettings: fontWeights.normal }}
        >
          {iconNode}
          <span>{copied ? "Copied" : "Copy"}</span>
        </span>
      ) : (
        <span
          className={cn(
            "shrink-0 px-1.5 py-2 transition-colors duration-80",
            "text-muted-foreground group-hover:text-foreground",
          )}
        >
          {iconNode}
        </span>
      );

    const valueElement = (
      <span
        className={cn(
          "flex-1 min-w-0 text-left text-[13px] text-foreground font-mono py-2 select-none truncate",
          align === "left" ? "pl-1" : "pl-0",
        )}
        style={{ fontVariationSettings: fontWeights.normal }}
      >
        {value}
      </span>
    );

    const button = (
      <button
        type="button"
        onClick={handleCopy}
        disabled={disabled}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
        className={cn(
          "group flex items-center w-full cursor-pointer outline-none",
          "transition-all duration-80",
          "focus-visible:ring-1 focus-visible:ring-[#6B97FF]",
          shape.input,
        )}
      >
        {align === "left" ? (
          <>
            {actionElement}
            {valueElement}
          </>
        ) : (
          <>
            {valueElement}
            {actionElement}
          </>
        )}
      </button>
    );

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-0.5",
          disabled && "opacity-50 pointer-events-none",
          className,
        )}
        {...props}
      >
        {label && (
          <span
            className={cn(
              "text-[13px] text-muted-foreground",
              align === "left" ? "pl-1" : "pl-0",
            )}
            style={{ fontVariationSettings: fontWeights.normal }}
          >
            {label}
          </span>
        )}
        {variant === "icon" ? (
          <Tooltip content={copied ? "Copied" : "Copy to clipboard"}>{button}</Tooltip>
        ) : (
          button
        )}
      </div>
    );
  },
);
InputCopy.displayName = "InputCopy";

export { InputCopy };
export type { InputCopyProps };

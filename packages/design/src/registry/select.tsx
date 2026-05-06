"use client";

import {
  type HTMLAttributes,
  type ReactNode,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "../lib/cn";
import { springs } from "../lib/springs";
import { useShape } from "../lib/shape-context";

/**
 * Tailwind/Radix-portal Select with animated dropdown. Compared to the legacy
 * the proximity-hover indicator is omitted; selected/active rows still fade
 * with framer-motion.
 */

interface SelectContextValue {
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled: boolean;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  labelMap: React.MutableRefObject<Map<string, string>>;
}

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext(): SelectContextValue {
  const ctx = useContext(SelectContext);
  if (!ctx) throw new Error("Select compound components must be inside <Select>");
  return ctx;
}

interface SelectProps {
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

function Select({
  children,
  value,
  defaultValue,
  onValueChange,
  disabled = false,
}: SelectProps): React.JSX.Element {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const currentValue = value !== undefined ? value : internalValue;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const labelMap = useRef(new Map<string, string>());

  const onChange = useCallback(
    (v: string): void => {
      if (value === undefined) setInternalValue(v);
      onValueChange?.(v);
      setOpen(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    },
    [value, onValueChange],
  );

  return (
    <SelectContext.Provider
      value={{ value: currentValue, onChange, open, setOpen, disabled, triggerRef, labelMap }}
    >
      {children}
    </SelectContext.Provider>
  );
}

interface SelectTriggerProps extends Omit<HTMLAttributes<HTMLButtonElement>, "children"> {
  placeholder?: string;
}

const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, placeholder = "Select…", ...props }, ref) => {
    const { value, open, setOpen, disabled, triggerRef, labelMap } = useSelectContext();
    const shape = useShape();
    const label = value ? (labelMap.current.get(value) ?? value) : undefined;

    return (
      <button
        ref={(node) => {
          (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
          if (typeof ref === "function") ref(node);
          else if (ref)
            (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
        }}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (
            !open &&
            (e.key === "ArrowDown" ||
              e.key === "ArrowUp" ||
              e.key === "Enter" ||
              e.key === " ")
          ) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "group inline-flex items-center justify-between gap-2 outline-none cursor-pointer",
          "text-[13px] h-9 px-3 min-w-[160px]",
          "border border-border bg-transparent text-foreground",
          "transition-all duration-80 hover:bg-hover",
          "disabled:opacity-50 disabled:pointer-events-none",
          "focus-visible:ring-1 focus-visible:ring-[#6B97FF]",
          shape.input,
          className,
        )}
        {...props}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1">
          <span className="min-w-0 flex-1 text-left truncate">
            {label ?? <span className="text-muted-foreground">{placeholder}</span>}
          </span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          className="shrink-0 text-muted-foreground transition-colors duration-80 group-hover:text-foreground"
        />
      </button>
    );
  },
);
SelectTrigger.displayName = "SelectTrigger";

interface SelectContentProps {
  className?: string;
  children: ReactNode;
}

const SelectContent = forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children }, ref) => {
    const { open, setOpen, triggerRef } = useSelectContext();
    const shape = useShape();
    const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (open && triggerRef.current) {
        setTriggerRect(triggerRef.current.getBoundingClientRect());
      }
    }, [open, triggerRef]);

    useEffect(() => {
      if (!open) return;
      const onKey = (e: KeyboardEvent): void => {
        if (e.key === "Escape") {
          setOpen(false);
          triggerRef.current?.focus();
        }
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [open, setOpen, triggerRef]);

    useEffect(() => {
      if (!open) return;
      const onPointer = (e: MouseEvent): void => {
        if (
          !containerRef.current?.contains(e.target as Node) &&
          !triggerRef.current?.contains(e.target as Node)
        ) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", onPointer);
      return () => document.removeEventListener("mousedown", onPointer);
    }, [open, setOpen, triggerRef]);

    if (!open) {
      return (
        <div hidden aria-hidden="true">
          {children}
        </div>
      );
    }
    if (!triggerRect) return null;

    return createPortal(
      <div
        style={{
          position: "fixed",
          top: triggerRect.bottom + 6,
          left: triggerRect.left,
          minWidth: triggerRect.width,
          zIndex: 50,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -4, scaleY: 0.96 }}
          animate={{ opacity: 1, y: 0, scaleY: 1 }}
          transition={springs.fast}
          style={{ transformOrigin: "top center" }}
        >
          <div
            ref={(node) => {
              (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
              if (typeof ref === "function") ref(node);
              else if (ref)
                (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
            }}
            role="listbox"
            tabIndex={-1}
            className={cn(
              "relative flex flex-col gap-0.5 max-h-[300px] overflow-y-auto",
              "bg-card border border-border/60 p-1 select-none outline-none",
              "shadow-[0_4px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
              shape.container,
              className,
            )}
          >
            {children}
          </div>
        </motion.div>
      </div>,
      document.body,
    );
  },
);
SelectContent.displayName = "SelectContent";

interface SelectItemProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
}

const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(
  ({ value, disabled = false, children, className, ...props }, ref) => {
    const { value: selectedValue, onChange, labelMap } = useSelectContext();
    const shape = useShape();

    useEffect(() => {
      if (typeof children === "string") {
        labelMap.current.set(value, children);
      }
    }, [value, children, labelMap]);

    const isChecked = selectedValue === value;

    return (
      <div
        ref={ref}
        role="option"
        aria-selected={isChecked}
        data-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (!disabled) onChange(value);
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault();
            onChange(value);
          }
        }}
        className={cn(
          "relative z-10 flex items-center gap-2 px-2 py-2 text-[13px] cursor-pointer outline-none select-none",
          "transition-[color,background] duration-80 hover:bg-hover",
          "focus-visible:ring-1 focus-visible:ring-[#6B97FF]",
          isChecked ? "text-foreground bg-selected/40 dark:bg-accent/40" : "text-muted-foreground",
          disabled && "opacity-50 pointer-events-none",
          shape.item,
          className,
        )}
        {...props}
      >
        <span className="flex-1 min-w-0 truncate">{children}</span>
        <AnimatePresence>
          {isChecked && (
            <motion.span
              key="check"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={springs.fast}
            >
              <Check size={14} strokeWidth={2} className="shrink-0 text-foreground" />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    );
  },
);
SelectItem.displayName = "SelectItem";

export { Select, SelectContent, SelectItem, SelectTrigger };
export type { SelectContentProps, SelectItemProps, SelectProps, SelectTriggerProps };

"use client";

import {
  Children,
  Fragment,
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  use,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import { springs } from "../lib/springs";
import { useShape } from "../lib/shape-context";
import { useIcon, type IconComponent } from "../lib/icon-context";
import { useProximityHover } from "../hooks/use-proximity-hover";

/**
 * Tailwind/Radix-portal Select with three animated motion overlays
 * (proximity-hover bg, animated checked-row bg, animated focus ring),
 * keyboard nav inside the listbox (Arrow/Home/End), close-on-scroll, and
 * native form participation via a hidden input. Ports `registry/default/select.tsx`
 * from upstream commit `d850ecf`.
 *
 * Back-compat: `SelectItem.index` is **optional** — `SelectContent` auto-fills
 * indices for direct `SelectItem` children that don't pass one. Explicit
 * `index` wins. Upstream requires `index`; auto-indexing keeps existing
 * Weekend call sites working without churn.
 */

// ---------------------------------------------------------------------------
// Select context
// ---------------------------------------------------------------------------

interface SelectContextValue {
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled: boolean;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  labelMap: React.MutableRefObject<Map<string, string>>;
  contentId: string;
}

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext(): SelectContextValue {
  const ctx = use(SelectContext);
  if (!ctx) throw new Error("Select compound components must be inside <Select>");
  return ctx;
}

// Content context for proximity hover
interface SelectContentContextValue {
  registerItem: (index: number, element: HTMLElement | null) => void;
  activeIndex: number | null;
  checkedIndex?: number;
}

const SelectContentContext = createContext<SelectContentContextValue | null>(null);

// ---------------------------------------------------------------------------
// Select (root)
// ---------------------------------------------------------------------------

interface SelectProps {
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  /** When set, mounts a hidden `<input>` so the select participates in native forms. */
  name?: string;
  /** Paired with `name`; mirrors the hidden input's `required` attribute. */
  required?: boolean;
}

function Select({
  children,
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  name,
  required,
}: SelectProps): React.JSX.Element {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const currentValue = value !== undefined ? value : internalValue;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const labelMap = useRef(new Map<string, string>());
  const contentId = useId();

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
      value={{
        value: currentValue,
        onChange,
        open,
        setOpen,
        disabled,
        triggerRef,
        labelMap,
        contentId,
      }}
    >
      {children}
      {name !== undefined && (
        <input type="hidden" name={name} value={currentValue} required={required} />
      )}
    </SelectContext.Provider>
  );
}
Select.displayName = "Select";

// ---------------------------------------------------------------------------
// SelectTrigger
// ---------------------------------------------------------------------------

const triggerVariants = cva(
  [
    "group inline-flex items-center justify-between gap-2 outline-none cursor-pointer",
    "text-[13px] h-9 px-3 min-w-[160px]",
    "transition-all duration-80",
    "disabled:opacity-50 disabled:pointer-events-none",
    "focus-visible:ring-1 focus-visible:ring-[#6B97FF]",
  ],
  {
    variants: {
      variant: {
        bordered: "border border-border bg-transparent text-foreground hover:bg-hover",
        borderless: "border border-transparent bg-transparent text-foreground hover:bg-hover",
      },
    },
    defaultVariants: { variant: "bordered" },
  },
);

interface SelectTriggerProps
  extends Omit<HTMLAttributes<HTMLButtonElement>, "children">,
    VariantProps<typeof triggerVariants> {
  /** Optional leading icon. Stroke-width transitions on hover. */
  icon?: IconComponent;
  placeholder?: string;
  /** When set, renders a `border-destructive/50` border + inline message under the trigger. */
  error?: string;
}

const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, variant, icon: Icon, placeholder = "Select…", error, ...props }, ref) => {
    const { value, open, setOpen, disabled, triggerRef, labelMap, contentId } = useSelectContext();
    const shape = useShape();
    const ChevronDown = useIcon("chevron-down");
    const label = value ? (labelMap.current.get(value) ?? value) : undefined;

    return (
      <div className="flex flex-col gap-1">
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
          aria-controls={contentId}
          aria-invalid={error ? true : undefined}
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
            triggerVariants({ variant }),
            shape.input,
            error && "border-destructive/50 hover:border-destructive/50",
            className,
          )}
          {...props}
        >
          <span className="flex items-center gap-2 min-w-0 flex-1">
            {Icon && (
              <Icon
                size={16}
                strokeWidth={1.5}
                className="shrink-0 text-muted-foreground transition-[color,stroke-width] duration-80 group-hover:text-foreground group-hover:stroke-[2]"
              />
            )}
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
        {error && <span className="text-[12px] text-destructive pl-3">{error}</span>}
      </div>
    );
  },
);
SelectTrigger.displayName = "SelectTrigger";

// ---------------------------------------------------------------------------
// SelectContent
// ---------------------------------------------------------------------------

interface SelectContentProps {
  className?: string;
  children: ReactNode;
}

/**
 * Walks the direct children, finds `SelectItem` elements, and assigns a
 * sequential `index` to any that don't have one. Non-`SelectItem` children
 * (groups, labels, separators) pass through untouched. `SelectGroup` is
 * recursed into so grouped items get correct sequential indices.
 */
function autoIndexChildren(children: ReactNode): ReactNode {
  let cursor = 0;
  const walk = (nodes: ReactNode): ReactNode =>
    Children.map(nodes, (child) => {
      if (!isValidElement(child)) return child;
      const childType = child.type as { displayName?: string } | string | symbol;
      const displayName =
        typeof childType === "string" || typeof childType === "symbol"
          ? ""
          : (childType?.displayName ?? "");

      // Fragments are transparent — recurse into their children.
      if (childType === Fragment) {
        const props = child.props as { children?: ReactNode };
        return walk(props.children);
      }

      if (displayName === "SelectItem") {
        const props = child.props as SelectItemProps;
        if (props.index === undefined) {
          const next = cloneElement(child as ReactElement<SelectItemProps>, { index: cursor });
          cursor += 1;
          return next;
        }
        // Explicit index — keep cursor in sync so subsequent autos don't collide.
        cursor = Math.max(cursor, props.index + 1);
        return child;
      }

      if (displayName === "SelectGroup") {
        const props = child.props as { children?: ReactNode };
        return cloneElement(child as ReactElement<{ children?: ReactNode }>, {
          children: walk(props.children),
        });
      }

      return child;
    });

  return walk(children);
}

const SelectContent = forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children }, ref) => {
    const { open, setOpen, value, triggerRef, contentId } = useSelectContext();
    const shape = useShape();
    const shouldReduceMotion = useReducedMotion();
    const containerRef = useRef<HTMLDivElement>(null);
    const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);

    const {
      activeIndex,
      setActiveIndex,
      itemRects,
      sessionRef,
      handlers,
      registerItem,
      measureItems,
    } = useProximityHover(containerRef, { axis: "y" });

    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
    const [checkedIndex, setCheckedIndex] = useState<number | undefined>(undefined);

    // Capture trigger rect synchronously when opening
    useEffect(() => {
      if (open && triggerRef.current) {
        setTriggerRect(triggerRef.current.getBoundingClientRect());
      }
    }, [open, triggerRef]);

    // Measure items + detect checked AFTER the portal has mounted.
    // Double rAF: first waits for React commit, second for layout.
    useEffect(() => {
      if (!open || !triggerRect) return;
      let outer = 0;
      let inner = 0;
      outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => {
          measureItems();
          const container = containerRef.current;
          if (container) {
            const items = Array.from(
              container.querySelectorAll("[data-proximity-index]"),
            ) as HTMLElement[];
            const idx = items.findIndex((el) => el.getAttribute("data-value") === value);
            setCheckedIndex(idx !== -1 ? idx : undefined);
            // Focus the container so keyboard events fire on it.
            container.focus({ preventScroll: true });
          }
        });
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }, [open, triggerRect, measureItems, value]);

    // Close on Escape
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

    // Close on click outside
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

    // Close on scroll (instead of locking body scroll, which causes layout shift)
    useEffect(() => {
      if (!open) return;
      const onScroll = (): void => setOpen(false);
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }, [open, setOpen]);

    // Keyboard nav inside content (Arrow/Home/End)
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent): void => {
        const items = Array.from(
          containerRef.current?.querySelectorAll('[role="option"]:not([data-disabled])') ?? [],
        ) as HTMLElement[];
        const currentIdx = items.indexOf(e.target as HTMLElement);

        if (["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) {
          e.preventDefault();
          if (currentIdx === -1) {
            // No item focused yet — focus checked or first item.
            const checked =
              value !== ""
                ? items.find((item) => item.getAttribute("data-value") === value)
                : null;
            (checked ?? items[0])?.focus();
          } else {
            const next = ["ArrowDown", "ArrowRight"].includes(e.key)
              ? (currentIdx + 1) % items.length
              : (currentIdx - 1 + items.length) % items.length;
            items[next]?.focus();
          }
        } else if (e.key === "Home") {
          e.preventDefault();
          items[0]?.focus();
        } else if (e.key === "End") {
          e.preventDefault();
          items[items.length - 1]?.focus();
        }
      },
      [value],
    );

    // Auto-index direct SelectItem children (back-compat for callers that
    // omit the upstream-required `index` prop).
    const indexedChildren = autoIndexChildren(children);

    // Render hidden when closed so items can register labels.
    if (!open) {
      return (
        <div hidden aria-hidden="true">
          {indexedChildren}
        </div>
      );
    }

    if (!triggerRect) return null;

    const activeRect = activeIndex !== null ? itemRects[activeIndex] : null;
    const checkedRect = checkedIndex != null ? itemRects[checkedIndex] : null;
    const focusRect = focusedIndex !== null ? itemRects[focusedIndex] : null;
    const isHoveringOther = activeIndex !== null && activeIndex !== checkedIndex;

    const ctxValue: SelectContentContextValue =
      checkedIndex !== undefined
        ? { registerItem, activeIndex, checkedIndex }
        : { registerItem, activeIndex };

    return createPortal(
      <SelectContentContext.Provider value={ctxValue}>
        <div
          style={{
            position: "fixed",
            top: triggerRect.bottom + 6,
            left: triggerRect.left,
            minWidth: triggerRect.width,
            zIndex: 50,
          }}
        >
          <LazyMotion features={domAnimation}>
          <m.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: -4, scaleY: 0.96 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            transition={shouldReduceMotion ? { duration: 0 } : springs.fast}
            style={{ transformOrigin: "top center" }}
          >
            <div
              ref={(node) => {
                (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                if (typeof ref === "function") ref(node);
                else if (ref)
                  (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
              }}
              id={contentId}
              role="listbox"
              tabIndex={-1}
              onMouseEnter={() => {
                handlers.onMouseEnter();
                setFocusedIndex(null);
              }}
              onMouseMove={handlers.onMouseMove}
              onMouseLeave={handlers.onMouseLeave}
              onFocus={(e) => {
                const indexAttr = (e.target as HTMLElement)
                  .closest("[data-proximity-index]")
                  ?.getAttribute("data-proximity-index");
                if (indexAttr != null) {
                  const idx = Number(indexAttr);
                  setActiveIndex(idx);
                  setFocusedIndex(
                    (e.target as HTMLElement).matches(":focus-visible") ? idx : null,
                  );
                }
              }}
              onBlur={(e) => {
                if (containerRef.current?.contains(e.relatedTarget as Node)) return;
                setFocusedIndex(null);
                setActiveIndex(null);
              }}
              onKeyDown={handleKeyDown}
              className={cn(
                "relative flex flex-col gap-0.5 max-h-[300px] overflow-y-auto",
                "bg-card border border-border/60 p-1 select-none outline-none",
                "shadow-[0_4px_12px_rgba(0,0,0,0.02)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
                shape.container,
                className,
              )}
            >
              {/* Checked-row background */}
              <AnimatePresence>
                {checkedRect && (
                  <m.div
                    className={cn("absolute pointer-events-none", shape.bg, "bg-selected/50 dark:bg-accent/40")}
                    initial={false}
                    animate={{
                      top: checkedRect.top,
                      left: checkedRect.left,
                      width: checkedRect.width,
                      height: checkedRect.height,
                      opacity: isHoveringOther ? 0.8 : 1,
                    }}
                    exit={{ opacity: 0, transition: { duration: shouldReduceMotion ? 0 : 0.12 } }}
                    transition={shouldReduceMotion ? { duration: 0 } : { ...springs.moderate, opacity: { duration: 0.08 } }}
                  />
                )}
              </AnimatePresence>

              {/* Proximity-hover background */}
              <AnimatePresence>
                {activeRect && (
                  <m.div
                    key={sessionRef.current}
                    className={cn("absolute pointer-events-none", shape.bg, "bg-accent/40 dark:bg-accent/25")}
                    initial={
                      shouldReduceMotion
                        ? false
                        : {
                            opacity: 0,
                            top: checkedRect?.top ?? activeRect.top,
                            left: checkedRect?.left ?? activeRect.left,
                            width: checkedRect?.width ?? activeRect.width,
                            height: checkedRect?.height ?? activeRect.height,
                          }
                    }
                    animate={{
                      opacity: 1,
                      top: activeRect.top,
                      left: activeRect.left,
                      width: activeRect.width,
                      height: activeRect.height,
                    }}
                    exit={{ opacity: 0, transition: { duration: shouldReduceMotion ? 0 : 0.06 } }}
                    transition={shouldReduceMotion ? { duration: 0 } : { ...springs.fast, opacity: { duration: 0.08 } }}
                  />
                )}
              </AnimatePresence>

              {/* Animated focus ring */}
              <AnimatePresence>
                {focusRect && (
                  <m.div
                    className={cn(
                      "absolute pointer-events-none z-20 border border-[#6B97FF]",
                      shape.focusRing,
                    )}
                    initial={false}
                    animate={{
                      left: focusRect.left - 2,
                      top: focusRect.top - 2,
                      width: focusRect.width + 4,
                      height: focusRect.height + 4,
                    }}
                    exit={{ opacity: 0, transition: { duration: shouldReduceMotion ? 0 : 0.06 } }}
                    transition={shouldReduceMotion ? { duration: 0 } : { ...springs.fast, opacity: { duration: 0.08 } }}
                  />
                )}
              </AnimatePresence>

              {indexedChildren}
            </div>
          </m.div>
          </LazyMotion>
        </div>
      </SelectContentContext.Provider>,
      document.body,
    );
  },
);
SelectContent.displayName = "SelectContent";

// ---------------------------------------------------------------------------
// SelectItem
// ---------------------------------------------------------------------------

interface SelectItemProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional leading icon. Stroke-width toggles between 1.5 and 2 on active/checked. */
  icon?: IconComponent;
  /**
   * Position within the listbox, used by proximity-hover and the animated
   * checked/focus overlays. Optional — `SelectContent` auto-fills sequential
   * indices for direct children that omit it. Upstream requires it; pass it
   * explicitly when items are rendered conditionally or interleaved.
   */
  index?: number;
  value: string;
  disabled?: boolean;
}

const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(
  (
    {
      className,
      children,
      icon: Icon,
      value,
      index,
      disabled = false,
      ...props
    },
    ref,
  ) => {
    const selectCtx = useSelectContext();
    const contentCtx = use(SelectContentContext);
    const internalRef = useRef<HTMLDivElement>(null);
    const shape = useShape();
    const hasMounted = useRef(false);
    const shouldReduceMotion = useReducedMotion();

    useEffect(() => {
      hasMounted.current = true;
    }, []);

    // Register label with root context
    useEffect(() => {
      if (typeof children === "string") {
        selectCtx.labelMap.current.set(value, children);
      }
    }, [value, children, selectCtx.labelMap]);

    // Resolved index — explicit > auto-injected by SelectContent. We default
    // to 0 only if both are absent (which means the item rendered outside
    // SelectContent; proximity hover is a no-op there).
    const resolvedIndex = index ?? 0;

    // Register with proximity hover (only when content context exists = open)
    useEffect(() => {
      contentCtx?.registerItem(resolvedIndex, internalRef.current);
      return () => contentCtx?.registerItem(resolvedIndex, null);
    }, [resolvedIndex, contentCtx]);

    const isActive = contentCtx?.activeIndex === resolvedIndex;
    const isChecked = selectCtx.value === value;
    const skipAnimation = !hasMounted.current;

    return (
      <div
        ref={(node) => {
          (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        data-proximity-index={resolvedIndex}
        data-value={value}
        data-disabled={disabled || undefined}
        role="option"
        aria-selected={isChecked}
        aria-label={typeof children === "string" ? children : undefined}
        tabIndex={
          isChecked ? 0 : resolvedIndex === (contentCtx?.checkedIndex ?? 0) ? 0 : -1
        }
        onClick={() => {
          if (!disabled) selectCtx.onChange(value);
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault();
            selectCtx.onChange(value);
          }
        }}
        className={cn(
          "relative z-10 flex items-center gap-2 px-2 py-2 text-[13px] cursor-pointer outline-none select-none",
          "transition-[color] duration-80",
          shape.item,
          isActive || isChecked ? "text-foreground" : "text-muted-foreground",
          disabled && "opacity-50 pointer-events-none",
          className,
        )}
        {...props}
      >
        {Icon && (
          <Icon
            size={16}
            strokeWidth={isActive || isChecked ? 2 : 1.5}
            className="shrink-0 transition-[color,stroke-width] duration-80"
          />
        )}

        <span className="flex-1 min-w-0 truncate">{children}</span>

        <LazyMotion features={domAnimation}>
          <AnimatePresence>
            {isChecked && (
              <m.svg
                key="check"
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-foreground"
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 1 }}
              >
                <m.path
                  d="M4 12L9 17L20 6"
                  initial={{ pathLength: skipAnimation || shouldReduceMotion ? 1 : 0 }}
                  animate={{
                    pathLength: 1,
                    transition: { duration: shouldReduceMotion ? 0 : 0.08, ease: "easeOut" },
                  }}
                  exit={{
                    pathLength: 0,
                    transition: { duration: shouldReduceMotion ? 0 : 0.04, ease: "easeIn" },
                  }}
                />
              </m.svg>
            )}
          </AnimatePresence>
        </LazyMotion>
      </div>
    );
  },
);
SelectItem.displayName = "SelectItem";

// ---------------------------------------------------------------------------
// SelectGroup + SelectLabel + SelectSeparator
// ---------------------------------------------------------------------------

function SelectGroup({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div role="group" className={className} {...props}>
      {children}
    </div>
  );
}
SelectGroup.displayName = "SelectGroup";

const SelectLabel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-2 py-1.5 text-[11px] text-muted-foreground", className)}
      {...props}
    />
  ),
);
SelectLabel.displayName = "SelectLabel";

const SelectSeparator = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="separator"
      className={cn("my-1 -mx-1 h-px bg-border/60", className)}
      {...props}
    />
  ),
);
SelectSeparator.displayName = "SelectSeparator";

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  triggerVariants,
};
export type {
  SelectContentProps,
  SelectItemProps,
  SelectProps,
  SelectTriggerProps,
};

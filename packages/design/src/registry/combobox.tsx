"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";
import { useShape } from "../lib/shape-context";

/**
 * Combobox — trigger button + popover with a free-text input and filterable
 * preset list. Generic on `T extends string` so consumers can pass literal-
 * union types like `"claude" | "codex"` and get back narrowed values.
 *
 * Single-component, prop-driven (not compound). When `allowFreeText` is true
 * (the default), typing in the input updates the external value directly so
 * the consumer reflects the in-progress text. When false, the input only
 * filters the visible items and selecting an item is the only way to commit.
 */

export interface ComboboxItem<T extends string = string> {
  readonly value: T;
  readonly label: string;
}

export type ComboboxVariant = "default" | "ghost";

export interface ComboboxProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  items: ReadonlyArray<ComboboxItem<T>>;
  placeholder?: string;
  /** Default true. When false, only items.value can be selected (acts like a Select). */
  allowFreeText?: boolean;
  /** Optional input placeholder when popover is open. Defaults to placeholder. */
  inputPlaceholder?: string;
  /** Trigger appearance. `default` is form-input style; `ghost` is borderless and lighter for use in toolbars. */
  variant?: ComboboxVariant;
  className?: string;
  disabled?: boolean;
  /** Width of the popover panel; defaults to 280px. */
  popoverWidth?: number;
}

const TRIGGER_BASE =
  "group inline-flex items-center justify-between gap-2 outline-none cursor-pointer text-[13px] transition-all duration-80 disabled:opacity-50 disabled:pointer-events-none focus-visible:ring-1 focus-visible:ring-[#6B97FF]";

const TRIGGER_VARIANT: Record<ComboboxVariant, string> = {
  default:
    "h-9 px-3 min-w-[160px] border border-border bg-transparent text-foreground hover:bg-hover",
  ghost:
    "h-7 px-2 bg-transparent text-muted-foreground hover:text-foreground",
};

export function Combobox<T extends string = string>({
  value,
  onChange,
  items,
  placeholder = "Select…",
  allowFreeText = true,
  inputPlaceholder,
  variant = "default",
  className,
  disabled = false,
  popoverWidth = 280,
}: ComboboxProps<T>): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const shape = useShape();
  const inputRef = useRef<HTMLInputElement>(null);

  // When the popover opens, seed query so filtering starts from the current
  // value (so the input reflects what the consumer has). When it closes, drop
  // the highlight so reopening starts neutral.
  useEffect(() => {
    if (open) {
      setQuery(value);
      setHighlightedIndex(-1);
    }
  }, [open, value]);

  const filteredItems = useMemo(() => {
    // Pragmatic: if the query exactly matches the current value AND that
    // value matches a known item, show all items (popover just opened on a
    // selection — user shouldn't have to clear to see siblings).
    const exactMatchIsCurrent = query === value && items.some((it) => it.value === value);
    if (exactMatchIsCurrent || query.length === 0) return items;
    const q = query.toLowerCase();
    return items.filter((it) => it.label.toLowerCase().includes(q));
  }, [items, query, value]);

  const selectItem = (next: T): void => {
    onChange(next);
    setOpen(false);
  };

  const handleInputChange = (next: string): void => {
    setQuery(next);
    setHighlightedIndex(-1);
    if (allowFreeText) {
      onChange(next as T);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (filteredItems.length === 0) return;
      setHighlightedIndex((prev) => (prev + 1) % filteredItems.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (filteredItems.length === 0) return;
      setHighlightedIndex((prev) =>
        prev <= 0 ? filteredItems.length - 1 : prev - 1,
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const target =
        highlightedIndex >= 0 && highlightedIndex < filteredItems.length
          ? filteredItems[highlightedIndex]
          : undefined;
      if (target) {
        selectItem(target.value);
      } else {
        // Free-text already committed via onChange — just close.
        setOpen(false);
      }
    }
  };

  const displayLabel =
    items.find((it) => it.value === value)?.label ?? (value as string);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          className={cn(
            TRIGGER_BASE,
            TRIGGER_VARIANT[variant],
            variant === "default" && shape.input,
            className,
          )}
        >
          <span className="min-w-0 flex-1 text-left truncate">
            {displayLabel ? (
              displayLabel
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronDown
            size={16}
            strokeWidth={1.5}
            className="shrink-0 text-muted-foreground transition-colors duration-80 group-hover:text-foreground"
          />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          style={{ width: popoverWidth }}
          onOpenAutoFocus={(e) => {
            // Let our input own focus.
            e.preventDefault();
            inputRef.current?.focus();
          }}
          className={cn(
            "z-50 overflow-hidden bg-card border border-border/60",
            "shadow-[0_4px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            shape.container,
          )}
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={inputPlaceholder ?? placeholder}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className={cn(
              "w-full bg-transparent px-3 py-2 text-[13px] outline-none",
              "placeholder:text-muted-foreground/50",
            )}
          />
          <div className="border-t border-border/60" />
          <ul role="listbox" className="max-h-[280px] overflow-y-auto py-1">
            {filteredItems.length === 0 ? (
              <li
                role="presentation"
                className="px-3 py-2 text-[13px] text-muted-foreground/60"
              >
                No matches
              </li>
            ) : (
              filteredItems.map((item, index) => {
                const isSelected = item.value === value;
                const isHighlighted = index === highlightedIndex;
                return (
                  <li key={item.value} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={() => selectItem(item.value)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px]",
                        "transition-colors duration-80 outline-none",
                        "hover:bg-hover",
                        isHighlighted && "bg-hover",
                        isSelected && "text-foreground",
                        !isSelected && "text-muted-foreground",
                      )}
                    >
                      <Check
                        size={14}
                        strokeWidth={2}
                        className={cn(
                          "shrink-0 text-foreground",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                        data-testid={
                          isSelected ? "combobox-check-selected" : undefined
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

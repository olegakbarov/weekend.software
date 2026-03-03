/**
 * SelectionPopover - Floating action menu for text selection
 *
 * Detects text selection in its children and shows a floating popover
 * with contextual actions. Used in the markdown editor to enable
 * "rewrite with selection" functionality.
 */

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Pencil } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

interface SelectionPopoverProps {
  children: ReactNode;
  onRewriteSelection?: (selectedText: string) => void;
  disabled?: boolean;
  className?: string;
}

interface SelectionState {
  text: string;
  rect: DOMRect;
}

export function SelectionPopover({
  children,
  onRewriteSelection,
  disabled = false,
  className,
}: SelectionPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Virtual reference element for popover positioning
  // Radix Popover expects RefObject<Measurable> with { current: { getBoundingClientRect: () => DOMRect } }
  const virtualRef = useMemo(() => {
    const measurable = {
      getBoundingClientRect: () => selection?.rect ?? new DOMRect(),
    };
    return { current: measurable };
  }, [selection]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setIsOpen(false);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (disabled || !onRewriteSelection) {
      return;
    }

    // Small delay to ensure selection is finalized
    requestAnimationFrame(() => {
      const windowSelection = window.getSelection();
      if (!windowSelection || windowSelection.isCollapsed) {
        clearSelection();
        return;
      }

      const text = windowSelection.toString().trim();
      if (!text || text.length < 3) {
        clearSelection();
        return;
      }

      // Check if selection is within our container
      const range = windowSelection.getRangeAt(0);
      if (!containerRef.current?.contains(range.commonAncestorContainer)) {
        clearSelection();
        return;
      }

      const rect = range.getBoundingClientRect();
      setSelection({ text, rect });
      setIsOpen(true);
    });
  }, [disabled, onRewriteSelection, clearSelection]);

  const handleRewrite = useCallback(() => {
    if (!(selection && onRewriteSelection)) {
      return;
    }
    onRewriteSelection(selection.text);
    // Clear browser selection after action
    window.getSelection()?.removeAllRanges();
    clearSelection();
  }, [selection, onRewriteSelection, clearSelection]);

  // Close popover when clicking outside, selection changes, or Escape
  useEffect(() => {
    const handleSelectionChange = () => {
      const windowSelection = window.getSelection();
      if (!windowSelection || windowSelection.isCollapsed) {
        clearSelection();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      // Don't close if clicking the popover itself
      const target = event.target as Node;
      const popoverContent = document.querySelector(
        "[data-selection-popover-content]"
      );
      if (popoverContent?.contains(target)) {
        return;
      }
      // Clear if clicking outside the container
      if (!containerRef.current?.contains(target)) {
        clearSelection();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        window.getSelection()?.removeAllRanges();
        clearSelection();
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, clearSelection]);

  if (disabled || !onRewriteSelection) {
    return <div className={className}>{children}</div>;
  }

  return (
    <PopoverPrimitive.Root onOpenChange={setIsOpen} open={isOpen}>
      <PopoverPrimitive.Anchor asChild virtualRef={virtualRef}>
        <div
          className={cn("select-text", className)}
          onMouseUp={handleMouseUp}
          ref={containerRef}
        >
          {children}
        </div>
      </PopoverPrimitive.Anchor>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="center"
          className={cn(
            "fade-in-0 zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 z-50 animate-in data-[state=closed]:animate-out",
            "rounded-md border border-border bg-card p-1 shadow-md"
          )}
          collisionPadding={8}
          data-selection-popover-content
          onOpenAutoFocus={(e) => e.preventDefault()}
          side="top"
          sideOffset={8}
        >
          <button
            className={cn(
              "flex items-center gap-1.5 rounded-sm px-2 py-1.5",
              "font-vcr text-[13px] text-foreground",
              "transition-colors hover:bg-secondary",
              "outline-none focus:bg-secondary"
            )}
            onClick={handleRewrite}
          >
            <Pencil className="size-3" />
            REWRITE WITH SELECTION
          </button>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

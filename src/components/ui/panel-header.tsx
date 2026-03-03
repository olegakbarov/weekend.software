/**
 * PanelHeader - Consistent header for sidebar panels.
 *
 * Ensures uniform height across all panel headers in the app.
 */

import { cn } from "@/lib/utils";

interface PanelHeaderProps {
  children: React.ReactNode;
  className?: string;
  /** Enable window dragging from this header (Tauri only) */
  draggable?: boolean;
}

export function PanelHeader({
  children,
  className,
  draggable,
}: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex h-12 shrink-0 items-center border-border px-2",
        className
      )}
      data-tauri-drag-region={draggable || undefined}
    >
      {children}
    </div>
  );
}

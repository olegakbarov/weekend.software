/**
 * PanelFooter - Consistent footer bar for panels and modals.
 *
 * Mirrors PanelHeader for the bottom edge: border-t, tinted background.
 */

import { cn } from "@/lib/utils";

interface PanelFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function PanelFooter({ children, className }: PanelFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-border border-t bg-secondary/20 px-4 py-3",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * CopyButton - Reusable copy-to-clipboard button with visual feedback
 */

import { Check, Copy } from "lucide-react";
import { memo, useCallback, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  text: string;
  className?: string;
  /** Size variant */
  size?: "sm" | "md";
  /** Show label text */
  showLabel?: boolean;
  /** Tooltip text for icon-only button. Set to false to disable. */
  tooltip?: string | false;
}

export const CopyButton = memo(function CopyButton({
  text,
  className,
  size = "sm",
  showLabel = false,
  tooltip,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [text]);

  const iconSize = size === "sm" ? "size-3" : "size-3.5";
  const tooltipText =
    tooltip === false
      ? null
      : (tooltip ?? (showLabel ? null : copied ? "COPIED" : "COPY"));

  const button = (
    <button
      className={cn(
        "inline-flex items-center gap-1 rounded transition-colors",
        size === "sm" ? "p-1" : "p-1.5",
        "text-muted-foreground hover:bg-white/10 hover:text-foreground",
        className
      )}
      onClick={handleCopy}
    >
      {copied ? (
        <Check className={cn(iconSize, "text-green-500")} />
      ) : (
        <Copy className={iconSize} />
      )}
      {showLabel && (
        <span className="font-vcr text-[12px]">
          {copied ? "COPIED" : "COPY"}
        </span>
      )}
    </button>
  );

  if (!tooltipText) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="top">
        <span className="font-vcr text-[12px]">{tooltipText}</span>
      </TooltipContent>
    </Tooltip>
  );
});

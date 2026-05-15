"use client";

import { type ReactNode } from "react";
import { Streamdown } from "streamdown";
import { cn } from "../lib/cn";
import "./code.css";

export interface CodeProps {
  /** Code content. Plain string — not markdown. */
  children: string;
  /** Language hint for syntax highlighting (e.g. "tsx", "json", "bash"). */
  language?: string;
  /** Show the small uppercase language label above the code. */
  showLanguage?: boolean;
  /** Show the copy button (revealed on hover). */
  showCopy?: boolean;
  /** Show the download button (revealed on hover). */
  showDownload?: boolean;
  className?: string;
}

export function Code({
  children,
  language = "text",
  showLanguage = true,
  showCopy = true,
  showDownload = false,
  className,
}: CodeProps) {
  return (
    <div
      className={cn(
        "weekend-code",
        !showLanguage && "weekend-code--no-language",
        !showCopy && "weekend-code--no-copy",
        !showDownload && "weekend-code--no-download",
        className,
      )}
    >
      <Streamdown>{`\`\`\`${language}\n${children}\n\`\`\``}</Streamdown>
    </div>
  );
}

export interface CodeInlineProps {
  children: ReactNode;
  className?: string;
}

export function CodeInline({ children, className }: CodeInlineProps) {
  return <code className={cn("weekend-code-inline", className)}>{children}</code>;
}

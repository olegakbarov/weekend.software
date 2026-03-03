/**
 * StreamingMarkdown - Renders streaming markdown content from AI agents
 * Uses streamdown library for optimized streaming markdown rendering with:
 * - Syntax highlighting via Shiki
 * - GFM (tables, task lists, strikethrough)
 * - Math rendering via KaTeX
 * - Mermaid diagrams
 * - Copy/download controls for code blocks
 */

import { useEffect, useRef, useState } from "react";
import {
  type ControlsConfig,
  type MermaidOptions,
  Streamdown,
  type StreamdownProps,
} from "streamdown";
import { cn } from "@/lib/utils";
import { SimpleErrorBoundary } from "./error-boundary";

interface StreamingMarkdownProps {
  content: string;
  className?: string;
  /** Whether content is actively streaming (shows caret indicator) */
  isStreaming?: boolean;
  /** Disable error boundary wrapper */
  skipErrorBoundary?: boolean;
  mode?: "static" | "streaming";
  controls?: ControlsConfig;
  components?: StreamdownProps["components"];
  parseIncompleteMarkdown?: boolean;
}

/** Shiki themes for light/dark mode - matches app color scheme */
const SHIKI_THEME: ["github-light", "github-dark"] = [
  "github-light",
  "github-dark",
];

const STREAMDOWN_CDN_URL = "/streamdown";

const MERMAID_OPTIONS: MermaidOptions = {
  config: {
    theme: "dark",
    securityLevel: "strict",
    fontFamily:
      'Berkeley Mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
};

function useThrottledValue<T>(value: T, delayMs: number, enabled: boolean): T {
  const [throttled, setThrottled] = useState(value);
  const lastUpdateRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || delayMs <= 0) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      lastUpdateRef.current = Date.now();
      setThrottled(value);
      return;
    }

    const now = Date.now();
    const elapsed = now - lastUpdateRef.current;
    const remaining = delayMs - elapsed;
    if (remaining <= 0) {
      lastUpdateRef.current = now;
      setThrottled(value);
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      lastUpdateRef.current = Date.now();
      setThrottled(value);
      timeoutRef.current = null;
    }, remaining);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [delayMs, enabled, value]);

  return throttled;
}

function StreamingMarkdownInner({
  content,
  className = "",
  isStreaming = false,
  mode = "streaming",
  controls = true,
  components,
  parseIncompleteMarkdown,
}: Omit<StreamingMarkdownProps, "skipErrorBoundary">) {
  const shouldParseIncomplete = parseIncompleteMarkdown ?? mode === "streaming";
  const displayContent = useThrottledValue(
    content,
    isStreaming ? 80 : 0,
    isStreaming
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const images = Array.from(container.querySelectorAll("img"));
    if (images.length === 0) return;

    const addFallback = (img: HTMLImageElement) => {
      if (img.dataset["streamdownImageError"] === "true") return;
      img.dataset["streamdownImageError"] = "true";
      img.classList.add("streamdown-image-broken");

      const wrapper =
        img.closest<HTMLElement>('[data-streamdown="image"]') ??
        img.parentElement;
      if (!wrapper) return;

      if (wrapper.querySelector(".streamdown-image-fallback")) return;
      const fallback = document.createElement("div");
      fallback.className = "streamdown-image-fallback";
      const alt = img.getAttribute("alt")?.trim();
      fallback.textContent = alt
        ? `Missing image: ${alt}`
        : "Image failed to load";
      wrapper.appendChild(fallback);
    };

    const clearFallback = (img: HTMLImageElement) => {
      img.dataset["streamdownImageError"] = "false";
      img.classList.remove("streamdown-image-broken");
      const wrapper =
        img.closest<HTMLElement>('[data-streamdown="image"]') ??
        img.parentElement;
      if (!wrapper) return;
      wrapper
        .querySelectorAll(".streamdown-image-fallback")
        .forEach((node) => node.remove());
    };

    const handleError = (event: Event) => {
      addFallback(event.currentTarget as HTMLImageElement);
    };

    const handleLoad = (event: Event) => {
      clearFallback(event.currentTarget as HTMLImageElement);
    };

    images.forEach((img) => {
      img.addEventListener("error", handleError);
      img.addEventListener("load", handleLoad);
      if (img.complete && img.naturalWidth === 0) {
        addFallback(img);
      }
    });

    return () => {
      images.forEach((img) => {
        img.removeEventListener("error", handleError);
        img.removeEventListener("load", handleLoad);
      });
    };
  }, []);

  return (
    <div
      className={cn("streamdown-content max-w-none", className)}
      ref={containerRef}
    >
      <Streamdown
        {...(mode === "streaming" && isStreaming ? { caret: "block" } : {})}
        cdnUrl={STREAMDOWN_CDN_URL}
        components={components ?? {}}
        controls={controls}
        isAnimating={isStreaming}
        mermaid={MERMAID_OPTIONS}
        mode={mode}
        parseIncompleteMarkdown={shouldParseIncomplete}
        shikiTheme={SHIKI_THEME}
      >
        {displayContent}
      </Streamdown>
    </div>
  );
}

export function StreamingMarkdown({
  skipErrorBoundary = false,
  ...props
}: StreamingMarkdownProps) {
  if (skipErrorBoundary) {
    return <StreamingMarkdownInner {...props} />;
  }
  return (
    <SimpleErrorBoundary resetKey={props.content}>
      <StreamingMarkdownInner {...props} />
    </SimpleErrorBoundary>
  );
}

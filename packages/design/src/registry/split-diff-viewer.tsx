"use client";

import {
  Component,
  type CSSProperties,
  forwardRef,
  type ReactNode,
  useMemo,
} from "react";
import type { FileDiffOptions } from "@pierre/diffs";
import { PatchDiff } from "@pierre/diffs/react";
import { cn } from "../lib/cn";

/**
 * SplitDiffViewer — wraps `<PatchDiff>` from @pierre/diffs with theme-aware
 * `--diffs-*` CSS variables. The component renders inside a Shadow DOM, so
 * tokens must reach it via inline style; class-based selectors won't pierce
 * the boundary.
 *
 * Two token sets are exposed: `diffsLightTokens` and `diffsDarkTokens`. The
 * caller picks one based on whether the active Weekend theme is light or
 * dark. Override individual values by spreading and replacing keys.
 */

export type DiffsThemeType = "light" | "dark";

const sharedTokens = {
  "--diffs-font-family":
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
} as const;

/**
 * Token bridge: every key maps a `@pierre/diffs` Shadow-DOM-bound CSS variable
 * to a Weekend-namespaced token defined in `tokens.css`. Each theme can
 * customise diff appearance by overriding the `--weekend-diffs-*` values in
 * its own theme block. The `themeType` argument only governs `themeType`
 * passed to `<PatchDiff>` (which controls Shiki's syntax-highlight palette).
 */
export const diffsThemedTokens: CSSProperties = {
  ...sharedTokens,
  "--diffs-bg": "var(--background)",
  "--diffs-fg": "var(--foreground)",
  "--diffs-bg-buffer-override": "var(--weekend-diffs-buffer-bg)",
  "--diffs-bg-context-override": "var(--muted)",
  "--diffs-bg-hover-override": "var(--accent)",
  "--diffs-bg-separator-override": "var(--border)",
  "--diffs-fg-number-override": "var(--muted-foreground)",
  "--diffs-addition-color-override": "var(--weekend-diffs-addition-color)",
  "--diffs-bg-addition-override": "var(--weekend-diffs-addition-bg)",
  "--diffs-bg-addition-number-override": "var(--weekend-diffs-addition-number-bg)",
  "--diffs-bg-addition-emphasis-override": "var(--weekend-diffs-addition-emphasis-bg)",
  "--diffs-deletion-color-override": "var(--weekend-diffs-deletion-color)",
  "--diffs-bg-deletion-override": "var(--weekend-diffs-deletion-bg)",
  "--diffs-bg-deletion-number-override": "var(--weekend-diffs-deletion-number-bg)",
  "--diffs-bg-deletion-emphasis-override": "var(--weekend-diffs-deletion-emphasis-bg)",
  "--diffs-scrollbar-track": "var(--muted)",
  "--diffs-scrollbar-thumb": "var(--scrollbar-thumb)",
  "--diffs-scrollbar-thumb-hover": "var(--muted-foreground)",
} as CSSProperties;

export interface SplitDiffViewerProps {
  patch: string;
  path: string;
  themeType: DiffsThemeType;
  diffStyle?: "split" | "unified";
  className?: string;
  /** Header rendered above the patch. Pass `null` to hide. */
  header?: ReactNode | null;
  /** Override the tokens object entirely. Defaults to `diffsLightTokens` /
   *  `diffsDarkTokens` based on `themeType`. */
  tokens?: CSSProperties;
  /** Per-line click — needed for inline comment annotations. */
  onLineClick?: FileDiffOptions<unknown>["onLineClick"];
  /** Element to render when the patch is empty. */
  emptyFallback?: ReactNode;
}

function looksLikeBinaryDiff(patch: string): boolean {
  const lower = patch.toLowerCase();
  return (
    lower.includes("git binary patch") ||
    lower.includes("binary files ") ||
    lower.includes("binary file ")
  );
}

// biome-ignore lint/style/useReactFunctionComponents: error boundaries require classes.
class DiffErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  override state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export const SplitDiffViewer = forwardRef<HTMLDivElement, SplitDiffViewerProps>(
  function SplitDiffViewer(
    {
      patch,
      path,
      themeType,
      diffStyle = "unified",
      className,
      header,
      tokens,
      onLineClick,
      emptyFallback,
    },
    ref
  ) {
    const hasContent = useMemo(() => patch.trim().length > 0, [patch]);
    const isBinary = useMemo(() => looksLikeBinaryDiff(patch), [patch]);
    const resolvedTokens = tokens ?? diffsThemedTokens;

    if (!hasContent) {
      return (
        <div
          className={cn(
            "rounded border border-border bg-muted/20 p-4 text-muted-foreground text-sm",
            className
          )}
          ref={ref}
        >
          {emptyFallback ?? `No diff available for ${path}`}
        </div>
      );
    }

    if (isBinary) {
      return (
        <div
          className={cn(
            "rounded border border-border bg-muted/20 p-4 text-muted-foreground text-sm",
            className
          )}
          ref={ref}
        >
          Binary file / diff unavailable for {path}
        </div>
      );
    }

    const options: FileDiffOptions<unknown> = {
      diffStyle,
      hunkSeparators: "simple",
      overflow: "scroll",
      themeType,
      ...(onLineClick ? { onLineClick } : {}),
    };

    return (
      <div
        className={cn("overflow-hidden rounded border border-border", className)}
        ref={ref}
      >
        {header}
        <DiffErrorBoundary
          fallback={
            <div className="p-4 text-muted-foreground text-sm">
              Diff unavailable for {path}
            </div>
          }
        >
          <PatchDiff options={options} patch={patch} style={resolvedTokens} />
        </DiffErrorBoundary>
      </div>
    );
  }
);

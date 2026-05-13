"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../lib/cn";

/**
 * DiffAnchors — compact list of changed-file paths used to navigate a
 * `<DiffStack>`. Each row shows a status badge (A/M/D/R/U) and the file
 * path, and clicking it should call the parent's `scrollToFile(path)`.
 *
 * The anchor list is intentionally read-only — staging/discard actions
 * belong to a separate component because not every consumer of DiffStack
 * needs git mutation. Weekend's diff view, for example, is purely a
 * "see what changed" pane today.
 */

export type DiffAnchorStatus = "A" | "M" | "D" | "R" | "U" | string;

export interface DiffAnchor {
  path: string;
  status: DiffAnchorStatus;
}

export interface DiffAnchorsProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  files: DiffAnchor[];
  activePath: string | null;
  onSelect: (path: string) => void;
  emptyState?: React.ReactNode;
}

const STATUS_CLASSES: Record<string, string> = {
  A: "text-(--color-green)",
  U: "text-(--color-green)",
  M: "text-(--color-amber)",
  R: "text-(--color-blue)",
  D: "text-(--color-red)",
};

const STATUS_LABELS: Record<string, string> = {
  A: "A",
  U: "U",
  M: "M",
  R: "R",
  D: "D",
};

export const DiffAnchors = forwardRef<HTMLDivElement, DiffAnchorsProps>(
  function DiffAnchors(
    { files, activePath, onSelect, emptyState, className, ...rest },
    ref
  ) {
    if (files.length === 0) {
      return (
        <div
          className={cn(
            "flex h-full items-center justify-center px-3",
            "text-center font-code text-muted-foreground text-xs",
            className
          )}
          ref={ref}
          {...rest}
        >
          {emptyState ?? "No changes"}
        </div>
      );
    }

    return (
      <div
        className={cn("flex h-full flex-col overflow-y-auto py-1", className)}
        ref={ref}
        {...rest}
      >
        {files.map((file) => {
          const isActive = file.path === activePath;
          const statusKey = STATUS_LABELS[file.status] ?? "M";

          return (
            <button
              data-active={isActive ? "" : undefined}
              key={file.path}
              onClick={() => onSelect(file.path)}
              type="button"
              className={cn(
                "group flex w-full items-center gap-2 px-3 py-1.5 text-left",
                "font-code text-xs",
                "transition-colors hover:bg-accent",
                isActive && "bg-accent"
              )}
              title={file.path}
            >
              <span
                className={cn(
                  "w-3 shrink-0 text-center font-bold",
                  STATUS_CLASSES[file.status] ?? "text-muted-foreground"
                )}
              >
                {statusKey}
              </span>
              <span className="min-w-0 flex-1 truncate text-foreground">
                {file.path}
              </span>
            </button>
          );
        })}
      </div>
    );
  }
);

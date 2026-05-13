"use client";

import { WorkerPoolContextProvider } from "@pierre/diffs/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  forwardRef,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../lib/cn";

/**
 * DiffStack — virtualized vertical list of file diffs that are mounted
 * eagerly (one per item in `files`). The caller renders each entry via the
 * `renderItem` prop, which is typically a `<SplitDiffViewer>`.
 *
 * Why virtualization: a project with 50 changed files would mount 50
 * `<PatchDiff>` instances, each with a Shadow DOM and Shiki highlighter.
 * Even with `WorkerPoolContextProvider` reusing one Web Worker across all
 * diffs, mounting them all at once will jank. TanStack Virtual mounts only
 * what's near the viewport (with overscan) and reuses the same DOM nodes
 * as the user scrolls.
 *
 * Active-anchor: the hook tracks which file's diff is "active" by sampling
 * the virtualizer at 35% from the viewport top. Click handlers on a
 * sibling anchor list call `scrollToFile(path)` via the imperative handle.
 */

const VIRTUAL_ESTIMATED_HEIGHT = 420;
const VIRTUAL_OVERSCAN = 4;
const VIRTUAL_GAP = 16;
const ACTIVE_OFFSET_RATIO = 0.35;
const SUPPRESS_ACTIVE_MS = 800;

export interface DiffStackHandle {
  scrollToFile: (path: string) => void;
}

export interface DiffStackItem {
  path: string;
}

export interface DiffStackProps<T extends DiffStackItem = DiffStackItem> {
  files: T[];
  renderItem: (file: T) => ReactNode;
  onActiveFileChange?: (path: string) => void;
  className?: string;
  emptyState?: ReactNode;
  /**
   * Pierre's diff worker. Pass a factory that returns `new Worker(workerUrl,
   * { type: "module" })`. Lives in the consuming app because the worker URL
   * import (`@pierre/diffs/worker/worker.js?worker&url`) is bundler-specific.
   */
  workerFactory: () => Worker;
}

export const DiffStack = forwardRef<DiffStackHandle, DiffStackProps>(
  function DiffStack(
    {
      files,
      renderItem,
      onActiveFileChange,
      className,
      emptyState,
      workerFactory,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const onActiveChangeRef = useRef(onActiveFileChange);
    const activePathRef = useRef<string | null>(null);
    const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [suppressActive, setSuppressActive] = useState(false);

    onActiveChangeRef.current = onActiveFileChange;

    const fileIndexByPath = useMemo(
      () => new Map(files.map((file, index) => [file.path, index])),
      [files]
    );

    useEffect(() => {
      return () => {
        if (suppressTimerRef.current) {
          clearTimeout(suppressTimerRef.current);
        }
      };
    }, []);

    const virtualizer = useVirtualizer({
      count: files.length,
      getScrollElement: () => containerRef.current,
      estimateSize: () => VIRTUAL_ESTIMATED_HEIGHT,
      overscan: VIRTUAL_OVERSCAN,
      gap: VIRTUAL_GAP,
    });
    const virtualItems = virtualizer.getVirtualItems();

    const suppressActiveUpdates = useCallback(
      (durationMs = SUPPRESS_ACTIVE_MS) => {
        setSuppressActive(true);
        if (suppressTimerRef.current) {
          clearTimeout(suppressTimerRef.current);
        }
        suppressTimerRef.current = setTimeout(() => {
          setSuppressActive(false);
          suppressTimerRef.current = null;
        }, durationMs);
      },
      []
    );

    const scrollToFile = useCallback(
      (path: string) => {
        const index = fileIndexByPath.get(path);
        if (index === undefined) return;
        suppressActiveUpdates();
        virtualizer.scrollToIndex(index, {
          align: "start",
          behavior: "smooth",
        });
      },
      [fileIndexByPath, suppressActiveUpdates, virtualizer]
    );

    useImperativeHandle(ref, () => ({ scrollToFile }), [scrollToFile]);

    const activePath = useMemo(() => {
      if (files.length === 0) return null;
      const scrollElement = containerRef.current;
      const viewportHeight = scrollElement?.clientHeight ?? 0;
      const scrollOffset = virtualizer.scrollOffset ?? 0;
      const targetOffset = scrollOffset + viewportHeight * ACTIVE_OFFSET_RATIO;
      const activeItem =
        virtualizer.getVirtualItemForOffset(targetOffset) ?? virtualItems[0];
      if (!activeItem) return null;
      return files[activeItem.index]?.path ?? null;
    }, [files, virtualItems, virtualizer, virtualizer.scrollOffset]);

    useEffect(() => {
      if (suppressActive || !activePath) return;
      if (activePathRef.current === activePath) return;
      activePathRef.current = activePath;
      onActiveChangeRef.current?.(activePath);
    }, [activePath, suppressActive]);

    const poolOptions = useMemo(() => ({ workerFactory }), [workerFactory]);
    const highlighterOptions = useMemo(() => ({}), []);

    if (files.length === 0) {
      return (
        <div
          className={cn(
            "flex h-full items-center justify-center",
            "text-muted-foreground text-sm",
            className
          )}
        >
          {emptyState ?? "No changed files"}
        </div>
      );
    }

    return (
      <WorkerPoolContextProvider
        highlighterOptions={highlighterOptions}
        poolOptions={poolOptions}
      >
        <div
          className={cn("h-full overflow-auto p-3", className)}
          ref={containerRef}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualItems.map((virtualRow) => {
              const file = files[virtualRow.index];
              if (!file) return null;
              return (
                <div
                  data-file-path={file.path}
                  data-index={virtualRow.index}
                  key={virtualRow.key}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {renderItem(file)}
                </div>
              );
            })}
          </div>
        </div>
      </WorkerPoolContextProvider>
    );
  }
) as <T extends DiffStackItem = DiffStackItem>(
  props: DiffStackProps<T> & { ref?: React.Ref<DiffStackHandle> }
) => ReactNode;

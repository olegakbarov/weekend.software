import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useRef,
  useState,
  type RefObject,
} from "react";

export interface ProximityRect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

export interface ProximityHandlers {
  onMouseEnter: () => void;
  onMouseMove: (e: ReactMouseEvent<HTMLElement>) => void;
  onMouseLeave: () => void;
}

export interface ProximityHoverApi {
  /** Index of the registered item closest to the cursor, or `null`. */
  activeIndex: number | null;
  setActiveIndex: (index: number | null) => void;
  /** Item rects, indexed by `index`, expressed relative to the container. */
  itemRects: ReadonlyArray<ProximityRect | undefined>;
  /** Increments each time the cursor enters the container — useful as a motion `key`. */
  sessionRef: RefObject<number>;
  /** Mouse handlers to spread onto the container element. */
  handlers: ProximityHandlers;
  /** Register or unregister an item element by index. */
  registerItem: (index: number, element: HTMLElement | null) => void;
  /** Recompute item rects (call after content size changes). */
  measureItems: () => void;
}

/**
 * Tracks which registered item the cursor is closest to within a container.
 * The "closest center" model — rather than strict pointer-over — yields smoother
 * indicator transitions for animated hover backgrounds.
 */
export function useProximityHover(
  containerRef: RefObject<HTMLElement | null>,
): ProximityHoverApi {
  const itemsRef = useRef<Map<number, HTMLElement>>(new Map());
  const [itemRects, setItemRects] = useState<Array<ProximityRect | undefined>>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const sessionRef = useRef(0);

  const registerItem = useCallback((index: number, element: HTMLElement | null): void => {
    if (element) itemsRef.current.set(index, element);
    else itemsRef.current.delete(index);
  }, []);

  const measureItems = useCallback((): void => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const sortedKeys = Array.from(itemsRef.current.keys()).sort((a, b) => a - b);
    const max = sortedKeys.length === 0 ? 0 : (sortedKeys[sortedKeys.length - 1] ?? 0) + 1;
    const rects: Array<ProximityRect | undefined> = new Array(max);
    for (const k of sortedKeys) {
      const el = itemsRef.current.get(k);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      rects[k] = {
        top: r.top - containerRect.top,
        left: r.left - containerRect.left,
        width: r.width,
        height: r.height,
      };
    }
    setItemRects(rects);
  }, [containerRef]);

  const onMouseEnter = useCallback((): void => {
    sessionRef.current += 1;
    measureItems();
  }, [measureItems]);

  const onMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLElement>): void => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      let bestIndex: number | null = null;
      let bestDist = Infinity;
      for (let i = 0; i < itemRects.length; i++) {
        const ir = itemRects[i];
        if (!ir) continue;
        const cx = ir.left + ir.width / 2;
        const cy = ir.top + ir.height / 2;
        const dx = x - cx;
        const dy = y - cy;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          bestIndex = i;
        }
      }
      setActiveIndex(bestIndex);
    },
    [containerRef, itemRects],
  );

  const onMouseLeave = useCallback((): void => {
    setActiveIndex(null);
  }, []);

  return {
    activeIndex,
    setActiveIndex,
    itemRects,
    sessionRef,
    handlers: { onMouseEnter, onMouseMove, onMouseLeave },
    registerItem,
    measureItems,
  };
}

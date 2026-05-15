"use client";

import {
  createContext,
  use,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

export type ShapeVariant = "pill" | "rounded";
/** @deprecated Use ShapeVariant. Kept for back-compat with earlier Weekend call sites. */
export type ShapeMode = ShapeVariant;

const shapeOrder: ShapeVariant[] = ["rounded", "pill"];

export interface ShapeClasses {
  /** Border radius for an item inside a menu/list. */
  item: string;
  /** Border radius for an animated background indicator. */
  bg: string;
  /** Border radius for a focus ring. */
  focusRing: string;
  /** Border radius for a "merged" background (e.g. nested item bg). */
  mergedBg: string;
  /** Border radius for a container/popover/menu shell. */
  container: string;
  /** Border radius for a button. */
  button: string;
  /** Border radius for input-sized fields (Select trigger, etc.). */
  input: string;
}

export const shapeMap: Record<ShapeVariant, ShapeClasses> = {
  pill: {
    item: "rounded-[20px]",
    bg: "rounded-[20px]",
    focusRing: "rounded-[20px]",
    mergedBg: "rounded-2xl",
    container: "rounded-3xl",
    button: "rounded-[20px]",
    input: "rounded-[20px]",
  },
  rounded: {
    item: "rounded-lg",
    bg: "rounded-lg",
    focusRing: "rounded-[10px]",
    mergedBg: "rounded-lg",
    container: "rounded-xl",
    button: "rounded-lg",
    input: "rounded-lg",
  },
};

interface ShapeContextValue {
  shape: ShapeVariant;
  setShape: (shape: ShapeVariant) => void;
  classes: ShapeClasses;
}

const ShapeContext = createContext<ShapeContextValue | null>(null);

function isShapeVariant(value: unknown): value is ShapeVariant {
  return value === "pill" || value === "rounded";
}

function readShellShape(defaultShape: ShapeVariant): ShapeVariant {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return defaultShape;
  }
  const shellShape = (
    window as {
      __WEEKEND_SHELL_DESIGN_SYSTEM__?: { shape?: unknown };
    }
  ).__WEEKEND_SHELL_DESIGN_SYSTEM__?.shape;
  if (isShapeVariant(shellShape)) return shellShape;
  const attrShape = document.documentElement.dataset["shape"];
  return isShapeVariant(attrShape) ? attrShape : defaultShape;
}

/**
 * Returns the current shape's class strings. Falls back to `pill` if no
 * `<ShapeProvider>` is mounted (matches upstream behaviour).
 */
export function useShape(): ShapeClasses {
  const ctx = use(ShapeContext);
  if (!ctx) return shapeMap.pill;
  return ctx.classes;
}

/**
 * Full context access — returns `{ shape, setShape, classes }`.
 * Throws if no `<ShapeProvider>` is mounted.
 */
export function useShapeContext(): ShapeContextValue {
  const ctx = use(ShapeContext);
  if (!ctx) throw new Error("useShapeContext must be used within a ShapeProvider");
  return ctx;
}

/**
 * Run `callback` with the `<html>` element flagged for the global
 * `html.transitioning` CSS rule (see tokens.css). Removes the class after
 * 200ms — pairs with the rule's 180ms transition.
 */
export function transitionShape(callback: () => void): void {
  if (typeof document === "undefined") {
    callback();
    return;
  }
  const root = document.documentElement;
  root.classList.add("transitioning");
  void root.offsetHeight;
  callback();
  setTimeout(() => root.classList.remove("transitioning"), 200);
}

export function ShapeProvider({
  children,
  defaultShape = "pill",
  shape: controlledShape,
  onShapeChange,
}: {
  children: ReactNode;
  defaultShape?: ShapeVariant;
  shape?: ShapeVariant;
  onShapeChange?: (shape: ShapeVariant) => void;
}): React.JSX.Element {
  const [internalShape, setInternalShape] = useState<ShapeVariant>(() =>
    readShellShape(defaultShape)
  );
  const shape = controlledShape ?? internalShape;
  const isControlled = controlledShape !== undefined;

  const setShape = useCallback((next: ShapeVariant) => {
    transitionShape(() => {
      if (isControlled) {
        onShapeChange?.(next);
      } else {
        setInternalShape(next);
      }
    });
  }, [isControlled, onShapeChange]);

  // Mirror state onto <html data-shape> so CSS-only consumers
  // (anything that keys off `[data-shape="pill"|"rounded"]` in tokens.css)
  // stay in sync. This preserves the cross-webview Weekend behaviour from
  // the previous DOM-attribute-based implementation.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset["shape"] = shape;
  }, [shape]);

  useEffect(() => {
    if (typeof window === "undefined" || isControlled) return;
    const onDesignSystem = (event: Event) => {
      const next = (event as CustomEvent<{ shape?: unknown }>).detail?.shape;
      if (!isShapeVariant(next)) return;
      transitionShape(() => setInternalShape(next));
    };
    window.addEventListener("weekend:design-system", onDesignSystem);
    return () => {
      window.removeEventListener("weekend:design-system", onDesignSystem);
    };
  }, [isControlled]);

  // Global keyboard shortcut: R to cycle radius
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "r" && e.key !== "R") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      e.preventDefault();
      const idx = shapeOrder.indexOf(shape);
      setShape(shapeOrder[(idx + 1) % shapeOrder.length] ?? "pill");
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [setShape, shape]);

  return (
    <ShapeContext.Provider value={{ shape, setShape, classes: shapeMap[shape] }}>
      {children}
    </ShapeContext.Provider>
  );
}

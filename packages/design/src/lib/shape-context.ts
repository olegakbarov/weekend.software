import { useSyncExternalStore } from "react";

export type ShapeMode = "pill" | "rounded";

export interface ShapeClasses {
  /** Border radius for input-sized fields (Select trigger, button). */
  readonly input: string;
  /** Border radius for an item inside a menu/list. */
  readonly item: string;
  /** Border radius for a container/popover/menu shell. */
  readonly container: string;
  /** Border radius for an animated background indicator. */
  readonly bg: string;
  /** Border radius for a focus ring. */
  readonly focusRing: string;
}

const PILL: ShapeClasses = {
  input: "rounded-2xl",
  item: "rounded-2xl",
  container: "rounded-3xl",
  bg: "rounded-2xl",
  focusRing: "rounded-2xl",
};

const ROUNDED: ShapeClasses = {
  input: "rounded-lg",
  item: "rounded-lg",
  container: "rounded-xl",
  bg: "rounded-lg",
  focusRing: "rounded-md",
};

function subscribe(callback: () => void): () => void {
  if (typeof MutationObserver === "undefined") return () => {};
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-shape"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): ShapeMode {
  if (typeof document === "undefined") return "pill";
  return document.documentElement.dataset["shape"] === "rounded" ? "rounded" : "pill";
}

function getServerSnapshot(): ShapeMode {
  return "pill";
}

/** Reads `[data-shape]` from `<html>` reactively and returns the matching class set. */
export function useShape(): ShapeClasses {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return mode === "rounded" ? ROUNDED : PILL;
}

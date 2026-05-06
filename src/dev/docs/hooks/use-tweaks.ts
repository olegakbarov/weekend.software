import { useEffect, useState } from "react";
import { useShapeContext } from "@weekend/design/registry";

export type Shape = "pill" | "rounded";
export type Density = "comfy" | "compact";

export interface Tweaks {
  shape: Shape;
  density: Density;
  sidebarCollapsed: boolean;
}

const KEY = "fluid-docs.tweaks-v1";

const DEFAULTS: Tweaks = {
  shape: "pill",
  density: "comfy",
  sidebarCollapsed: false,
};

function load(): Tweaks {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Tweaks>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

/**
 * Tweaks store: persists shape/density/collapsed to localStorage. Theme is
 * owned by the host route. Shape is delegated to the design system's
 * `<ShapeProvider>` (Phase F), which is the single source of truth for the
 * `<html data-shape>` attribute and the React-Context class strings.
 */
export function useTweaks(): readonly [Tweaks, <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void] {
  const { shape, setShape } = useShapeContext();
  // Density and sidebarCollapsed remain owned here; shape mirrors the provider.
  const [tweaks, setTweaks] = useState<Tweaks>(() => ({ ...load(), shape }));

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(tweaks));
    } catch {
      // ignore quota
    }
    const root = document.documentElement;
    root.dataset["density"] = tweaks.density;
    root.style.setProperty("--shape-item", tweaks.shape === "pill" ? "20px" : "8px");
    root.style.setProperty("--shape-container", tweaks.shape === "pill" ? "24px" : "12px");
  }, [tweaks]);

  // Mirror provider shape into local tweaks state when it changes upstream.
  useEffect(() => {
    setTweaks((t) => (t.shape === shape ? t : { ...t, shape }));
  }, [shape]);

  const setTweak = <K extends keyof Tweaks>(key: K, value: Tweaks[K]): void => {
    if (key === "shape") {
      setShape(value as Shape);
      return;
    }
    setTweaks((t) => ({ ...t, [key]: value }));
  };

  return [tweaks, setTweak];
}

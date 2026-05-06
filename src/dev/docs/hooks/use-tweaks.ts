import { useEffect, useState } from "react";

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

/** Tweaks store: persists shape/density/collapsed to localStorage. Theme is owned by the host route. */
export function useTweaks(): readonly [Tweaks, <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void] {
  const [tweaks, setTweaks] = useState<Tweaks>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(tweaks));
    } catch {
      // ignore quota
    }
    const root = document.documentElement;
    root.dataset["shape"] = tweaks.shape;
    root.dataset["density"] = tweaks.density;
    root.style.setProperty("--shape-item", tweaks.shape === "pill" ? "20px" : "8px");
    root.style.setProperty("--shape-container", tweaks.shape === "pill" ? "24px" : "12px");
  }, [tweaks]);

  const setTweak = <K extends keyof Tweaks>(key: K, value: Tweaks[K]): void => {
    setTweaks((t) => ({ ...t, [key]: value }));
  };

  return [tweaks, setTweak];
}

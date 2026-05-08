import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_THEME,
  isThemeName,
  type ThemeName,
} from "./constants";
import { ShellThemeContext } from "./shell-theme-context";

/**
 * Drop-in observer of the shell-injected theme. Mount this once near the
 * root of a project app (above any consumer of `useShellTheme`). The bridge
 * is purely an observer — it does NOT write `data-theme`, `localStorage`, or
 * any other state. The Weekend shell owns those and broadcasts updates via
 * the `weekend:theme` window event; this component subscribes and republishes
 * through React context so consumer renders stay in lockstep with shell
 * theme changes.
 *
 * For projects opened outside the Weekend shell (e.g. `vite dev` directly in
 * a browser tab), the bridge falls back to whatever `<html data-theme>` is
 * set to, then `DEFAULT_THEME`. No shell present, no errors thrown.
 */
function readInitialTheme(): ThemeName {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const fromGlobal = window.__WEEKEND_SHELL_THEME__;
  if (isThemeName(fromGlobal)) return fromGlobal;
  const fromAttr = document.documentElement.dataset.theme;
  if (isThemeName(fromAttr)) return fromAttr;
  return DEFAULT_THEME;
}

export interface ShellThemeBridgeProps {
  children: ReactNode;
}

export function ShellThemeBridge({ children }: ShellThemeBridgeProps) {
  const [theme, setTheme] = useState<ThemeName>(readInitialTheme);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Resync on mount: the global may have changed between SSR snapshot and
    // hydration, or the shell may have broadcast before the bridge mounted.
    const next = readInitialTheme();
    setTheme((current) => (current === next ? current : next));

    const onTheme = (event: CustomEvent<{ theme: string }>) => {
      const value = event.detail?.theme;
      if (isThemeName(value)) {
        setTheme((current) => (current === value ? current : value));
      }
    };
    window.addEventListener("weekend:theme", onTheme as EventListener);
    return () => {
      window.removeEventListener("weekend:theme", onTheme as EventListener);
    };
  }, []);

  const value = useMemo(() => ({ theme }), [theme]);
  return (
    <ShellThemeContext.Provider value={value}>
      {children}
    </ShellThemeContext.Provider>
  );
}

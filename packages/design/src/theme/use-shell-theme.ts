import { use, useEffect, useState } from "react";
import {
  DEFAULT_THEME,
  isDarkTheme,
  isThemeName,
  type ThemeName,
} from "./constants";
import { ShellThemeContext } from "./shell-theme-context";

/**
 * The shell publishes the active theme through four anchors, in priority
 * order:
 *   1. `<ShellThemeBridge>` React context (preferred — set up once at the
 *      project root, every consumer re-renders synchronously when the shell
 *      broadcasts a theme change).
 *   2. `window.__WEEKEND_SHELL_THEME__` global (set by the shell's bridge
 *      preamble and kept current by the broadcast eval). Read once on mount
 *      as a fallback when the bridge is absent.
 *   3. `<html data-theme>` attribute. Last-resort read for environments where
 *      the bridge preamble has run but the global was wiped.
 *   4. `DEFAULT_THEME`. Read in pure browser dev (no shell at all).
 *
 * Either way the hook also subscribes to the `weekend:theme` window event so
 * a project that doesn't mount the bridge still re-renders on theme changes.
 */
export interface ShellTheme {
  theme: ThemeName;
  isDark: boolean;
}

declare global {
  interface Window {
    __WEEKEND_SHELL_THEME__?: string;
  }
  interface WindowEventMap {
    "weekend:theme": CustomEvent<{ theme: string }>;
  }
}

function readInitialTheme(): ThemeName {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const fromGlobal = window.__WEEKEND_SHELL_THEME__;
  if (isThemeName(fromGlobal)) return fromGlobal;
  const fromAttr = document.documentElement.dataset.theme;
  if (isThemeName(fromAttr)) return fromAttr;
  return DEFAULT_THEME;
}

export function useShellTheme(): ShellTheme {
  const fromContext = use(ShellThemeContext);
  const [fallback, setFallback] = useState<ThemeName>(readInitialTheme);

  useEffect(() => {
    if (fromContext) return; // bridge mounted; it already drives the context
    if (typeof window === "undefined") return;

    const refresh = () => {
      const next = readInitialTheme();
      setFallback((current) => (current === next ? current : next));
    };

    refresh();
    const onTheme = (event: CustomEvent<{ theme: string }>) => {
      const next = event.detail?.theme;
      if (isThemeName(next)) {
        setFallback((current) => (current === next ? current : next));
      }
    };
    window.addEventListener("weekend:theme", onTheme as EventListener);
    return () => {
      window.removeEventListener("weekend:theme", onTheme as EventListener);
    };
  }, [fromContext]);

  const theme = fromContext?.theme ?? fallback;
  return { theme, isDark: isDarkTheme(theme) };
}

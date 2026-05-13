/**
 * ThemeProvider - Single source of truth for the active theme.
 *
 * The active theme is one of four named themes. <html data-theme="..."> is the
 * authoritative attribute; CSS in @weekend/design's tokens.css and src/styles.css
 * scopes design tokens to that attribute. ThemeProvider does NOT write inline
 * `--*` token overrides anymore.
 *
 * Persistence and cross-window sync run through Tauri:
 *   - `invoke("get_active_theme")` reads ~/.weekend/theme.json on mount.
 *   - `invoke("set_active_theme", { theme })` persists + emits `theme-changed`.
 *   - `listen("theme-changed", ...)` keeps every webview in lockstep.
 *
 * `localStorage["weekend.theme"]` is a fast-path mirror used by the no-FOUC
 * script in index.html so the first paint already has the correct data-theme.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { applyThemeToDom, readStoredTheme } from "./theme-dom";
import { isDarkTheme, isThemeName, type ThemeName } from "./theme-model";
import { syncNativeTheme } from "./theme-native";

export { THEME_NAMES, type ThemeName } from "./theme-model";

interface ThemeContextValue {
  activeTheme: ThemeName;
  setActiveTheme: (theme: ThemeName) => void;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  // Fast-path init from localStorage (already applied to <html> by no-FOUC script).
  const [activeTheme, setActiveThemeState] =
    useState<ThemeName>(readStoredTheme);

  // Authoritative sync from disk on mount. The Rust command falls back to
  // "fluid" on read errors, so we always get a valid ThemeName back.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const persisted = await invoke<string>("get_active_theme");
        if (cancelled) return;
        if (isThemeName(persisted)) {
          setActiveThemeState((current) =>
            current === persisted ? current : persisted
          );
        }
      } catch (err) {
        console.warn("[Theme] get_active_theme failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Listen for cross-window broadcasts. Any window calling set_active_theme
  // will emit `theme-changed`; we update local state to match.
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let cancelled = false;
    void (async () => {
      try {
        const off = await listen<{ theme: string }>(
          "theme-changed",
          (event) => {
            const next = event.payload?.theme;
            if (isThemeName(next)) {
              setActiveThemeState((current) =>
                current === next ? current : next
              );
            }
          }
        );
        if (cancelled) {
          off();
        } else {
          unlisten = off;
        }
      } catch (err) {
        console.warn("[Theme] listen('theme-changed') failed:", err);
      }
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // Apply <html data-theme>, mirror to localStorage, sync .dark/.light class
  // (kept so Tailwind `dark:` utilities + .dark selectors keep working), and
  // sync the native Tauri window theme + background.
  useEffect(() => {
    applyThemeToDom(activeTheme);
    syncNativeTheme(activeTheme);
  }, [activeTheme]);

  const setActiveTheme = useCallback(
    (next: ThemeName) => {
      if (next === activeTheme) return;

      // Optimistic update for snappiness; Rust will broadcast and our listener
      // will idempotently re-confirm.
      const previous = activeTheme;
      setActiveThemeState(next);
      void invoke("set_active_theme", { theme: next }).catch((err) => {
        console.error("[Theme] set_active_theme failed, reverting:", err);
        setActiveThemeState((current) =>
          current === next ? previous : current
        );
      });
    },
    [activeTheme]
  );

  const isDark = isDarkTheme(activeTheme);

  return (
    <ThemeContext.Provider value={{ activeTheme, setActiveTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Re-export useTheme for consumers that import directly from the provider.
export { useTheme } from "./use-theme";

/**
 * No-FOUC script — inlined into index.html so the first paint already has
 * <html data-theme="..."> set, before the JS bundle parses. Keep in sync with
 * ThemeProvider's storage key, valid theme list, and default.
 */
export { themeScript } from "./theme-dom";

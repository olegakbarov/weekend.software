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
import { getCurrentWindow } from "@/lib/tauri-mock";
import {
  safeLocalStorageGetItem,
  safeLocalStorageSetItem,
} from "@/lib/utils/safe-local-storage";

export type ThemeName =
  | "fluid"
  | "fluid-dark"
  | "weekend-dark"
  | "weekend-paper";

export const THEME_NAMES: readonly ThemeName[] = [
  "fluid",
  "fluid-dark",
  "weekend-dark",
  "weekend-paper",
] as const;

const DEFAULT_THEME: ThemeName = "fluid";
const STORAGE_KEY = "weekend.theme";

const DARK_THEMES: ReadonlySet<ThemeName> = new Set([
  "fluid-dark",
  "weekend-dark",
]);

/**
 * Canonical background colors per theme. Mirrors the `--background` value in
 * packages/design/src/tokens.css; used to set the native Tauri window
 * background to match the painted CSS background (avoids flicker on resize).
 */
const THEME_BACKGROUND_HEX: Record<ThemeName, string> = {
  fluid: "#fafafa",
  "fluid-dark": "#0a0a0a",
  "weekend-dark": "#000000",
  "weekend-paper": "#F5F0EB",
};

interface ThemeContextValue {
  activeTheme: ThemeName;
  setActiveTheme: (theme: ThemeName) => void;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeName(value: unknown): value is ThemeName {
  return (
    typeof value === "string" &&
    (THEME_NAMES as readonly string[]).includes(value)
  );
}

function readStoredTheme(): ThemeName {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const stored = safeLocalStorageGetItem(STORAGE_KEY);
  return isThemeName(stored) ? stored : DEFAULT_THEME;
}

function hexToRgba(hex: string) {
  const trimmed = hex.replace("#", "");
  const normalized =
    trimmed.length === 3
      ? trimmed
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : trimmed;

  if (normalized.length !== 6) {
    return { red: 0, green: 0, blue: 0, alpha: 255 };
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  if ([red, green, blue].some((value) => Number.isNaN(value))) {
    return { red: 0, green: 0, blue: 0, alpha: 255 };
  }

  return { red, green, blue, alpha: 255 };
}

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
    const root = document.documentElement;
    root.dataset.theme = activeTheme;

    const dark = DARK_THEMES.has(activeTheme);
    root.classList.toggle("dark", dark);
    root.classList.toggle("light", !dark);

    safeLocalStorageSetItem(STORAGE_KEY, activeTheme);

    const win = getCurrentWindow();
    const nativeMode = dark ? "dark" : "light";
    const bg = hexToRgba(THEME_BACKGROUND_HEX[activeTheme]);
    Promise.all([win.setTheme(nativeMode), win.setBackgroundColor(bg)]).catch(
      (err) => {
        console.warn("[Theme] failed to sync native window:", err);
      }
    );
  }, [activeTheme]);

  const setActiveTheme = useCallback((next: ThemeName) => {
    // Optimistic update for snappiness; Rust will broadcast and our listener
    // will idempotently re-confirm.
    setActiveThemeState((current) => (current === next ? current : next));
    void invoke("set_active_theme", { theme: next }).catch((err) => {
      console.error("[Theme] set_active_theme failed, reverting:", err);
      // Revert by re-reading from storage (the source we trust on error).
      setActiveThemeState(readStoredTheme());
    });
  }, []);

  const isDark = DARK_THEMES.has(activeTheme);

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
export const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('weekend.theme') || 'fluid';
    var valid = ['fluid','fluid-dark','weekend-dark','weekend-paper'];
    if (valid.indexOf(t) === -1) t = 'fluid';
    var root = document.documentElement;
    root.dataset.theme = t;
    var dark = t === 'fluid-dark' || t === 'weekend-dark';
    root.classList.toggle('dark', dark);
    root.classList.toggle('light', !dark);
  } catch (e) {}
})();
`;

/**
 * ThemeProvider - Theme context and provider
 */
import {
  darkStatusBadges,
  getColors,
  lightStatusBadges,
  withOpacity,
} from "@/lib/design-colors";
import {
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { getCurrentWindow } from "@/lib/tauri-mock";
import { applyThemePreset, type ThemePreset } from "@/lib/theme-presets";
import {
  safeLocalStorageGetItem,
  safeLocalStorageSetItem,
} from "@/lib/utils/safe-local-storage";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  // Mode (light/dark/system)
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolvedMode: "light" | "dark";

  // Preset (color theme)
  preset: ThemePreset;
  setPreset: (preset: ThemePreset) => void;

  // Custom hue (when preset is 'custom')
  customHue: number;
  setCustomHue: (hue: number) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY_MODE = "ispo-theme-mode";
const STORAGE_KEY_PRESET = "ispo-theme-preset";
const STORAGE_KEY_HUE = "ispo-theme-hue";

function applyDesignTokens(theme: "dark" | "light") {
  const colors = getColors(theme);
  const root = document.documentElement;

  const tokens: Record<string, string> = {
    "--background": colors.background,
    "--foreground": colors.foreground,
    "--card": colors.card,
    "--card-foreground": colors.cardForeground,
    "--popover": colors.card,
    "--popover-foreground": colors.cardForeground,
    "--secondary": colors.secondary,
    "--secondary-foreground": colors.secondaryForeground,
    "--muted": colors.muted,
    "--muted-foreground": colors.mutedForeground,
    "--border": colors.border,
    "--input": colors.input,
    "--primary": colors.primary,
    "--primary-foreground": colors.primaryForeground,
    "--accent": colors.accent,
    "--accent-foreground": colors.accentForeground,
    "--destructive": colors.destructive,
    "--destructive-foreground": colors.destructiveForeground,
    "--success": colors.success,
    "--success-foreground": colors.successForeground,
    "--warning": colors.warning,
    "--warning-foreground": colors.warningForeground,
    "--text-highlight": colors.textHighlight,
    "--text-highlight-selection": withOpacity(
      colors.textHighlight,
      theme === "dark" ? 0.4 : 0.25
    ),
    "--text-highlight-selection-strong": withOpacity(
      colors.textHighlight,
      theme === "dark" ? 0.5 : 0.25
    ),
    "--ring": colors.textHighlight,
    "--status-running": colors.statusRunning,
    "--status-completed": colors.statusCompleted,
    "--status-failed": colors.statusFailed,
    "--status-pending": colors.statusPending,
    "--status-cancelled": colors.statusCancelled,
  };

  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value);
  }

  const badges = theme === "dark" ? darkStatusBadges : lightStatusBadges;
  root.style.setProperty("--badge-running", badges.running);
  root.style.setProperty("--badge-completed", badges.completed);
  root.style.setProperty("--badge-failed", badges.failed);
  root.style.setProperty("--badge-pending", badges.pending);

  return colors.background;
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
  defaultMode?: ThemeMode;
  defaultPreset?: ThemePreset;
}

export function ThemeProvider({
  children,
  defaultMode = "dark",
  defaultPreset = "default",
}: ThemeProviderProps) {
  // Initialize from localStorage or defaults
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return defaultMode;
    return (
      (safeLocalStorageGetItem(STORAGE_KEY_MODE) as ThemeMode) || defaultMode
    );
  });

  const [preset, setPresetState] = useState<ThemePreset>(() => {
    if (typeof window === "undefined") return defaultPreset;
    return (
      (safeLocalStorageGetItem(STORAGE_KEY_PRESET) as ThemePreset) ||
      defaultPreset
    );
  });

  const [customHue, setCustomHueState] = useState<number>(() => {
    if (typeof window === "undefined") return 250;
    const stored = safeLocalStorageGetItem(STORAGE_KEY_HUE);
    return stored ? Number.parseInt(stored, 10) : 250;
  });

  // Resolve system theme
  const [systemMode, setSystemMode] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemMode(mediaQuery.matches ? "dark" : "light");

    const handler = (e: MediaQueryListEvent) => {
      setSystemMode(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const resolvedMode = mode === "system" ? systemMode : mode;

  // Apply mode to document
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedMode);
  }, [resolvedMode]);

  // Sync design tokens + Tauri window theme and background color with app theme
  useEffect(() => {
    const win = getCurrentWindow();
    const theme = resolvedMode === "dark" ? "dark" : "light";
    const backgroundHex = applyDesignTokens(theme);
    const bgColor = hexToRgba(backgroundHex);

    console.log("[Theme] Setting window theme to:", theme, "bg:", bgColor);

    Promise.all([win.setTheme(theme), win.setBackgroundColor(bgColor)])
      .then(() =>
        console.log("[Theme] Window theme and background set successfully")
      )
      .catch((err) =>
        console.error("[Theme] Failed to set window theme:", err)
      );
  }, [resolvedMode]);

  // Apply preset/hue to document
  useEffect(() => {
    applyThemePreset(preset, customHue);
  }, [preset, customHue]);

  // Setters with persistence
  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    safeLocalStorageSetItem(STORAGE_KEY_MODE, newMode);
  }, []);

  const setPreset = useCallback((newPreset: ThemePreset) => {
    setPresetState(newPreset);
    safeLocalStorageSetItem(STORAGE_KEY_PRESET, newPreset);
  }, []);

  const setCustomHue = useCallback((hue: number) => {
    setCustomHueState(hue);
    safeLocalStorageSetItem(STORAGE_KEY_HUE, String(hue));
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        setMode,
        resolvedMode,
        preset,
        setPreset,
        customHue,
        setCustomHue,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// Re-export useTheme for backwards compatibility
export { useTheme } from "./use-theme";

/**
 * Script to prevent flash of unstyled content
 * Include this in index.html before the app
 */
export const themeScript = `
(function() {
  try {
    var mode = localStorage.getItem('${STORAGE_KEY_MODE}') || 'dark';
    var preset = localStorage.getItem('${STORAGE_KEY_PRESET}') || 'default';
    var hue = localStorage.getItem('${STORAGE_KEY_HUE}') || '250';

    // Apply mode
    if (mode === 'system') {
      mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.classList.add(mode);

    // Apply preset hue
    var presets = { default: 250, blue: 220, green: 145, orange: 35, pink: 330 };
    var brandHue = preset === 'custom' ? parseInt(hue, 10) : (presets[preset] || 250);
    document.documentElement.style.setProperty('--brand-hue', brandHue);
  } catch (e) {}
})();
`;

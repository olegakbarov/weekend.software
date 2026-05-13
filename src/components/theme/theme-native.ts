import { getCurrentWindow } from "@/lib/tauri-mock";
import { isDarkTheme, type ThemeName } from "./theme-model";

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

const TRANSPARENT_WINDOW_BACKGROUND = { red: 0, green: 0, blue: 0, alpha: 0 };

function isSharedDropWindow(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (window as { __WEEKEND_SHARED_DROP_WINDOW__?: boolean })
      .__WEEKEND_SHARED_DROP_WINDOW__ === true
  );
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

export function syncNativeTheme(theme: ThemeName): void {
  const dark = isDarkTheme(theme);
  const win = getCurrentWindow();
  const nativeMode = dark ? "dark" : "light";
  const bg = isSharedDropWindow()
    ? TRANSPARENT_WINDOW_BACKGROUND
    : hexToRgba(THEME_BACKGROUND_HEX[theme]);

  Promise.all([win.setTheme(nativeMode), win.setBackgroundColor(bg)]).catch(
    (err) => {
      console.warn("[Theme] failed to sync native window:", err);
    }
  );
}

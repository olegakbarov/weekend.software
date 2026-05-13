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

export const DEFAULT_THEME: ThemeName = "fluid";
export const THEME_STORAGE_KEY = "weekend.theme";

export const DARK_THEME_NAMES: readonly ThemeName[] = [
  "fluid-dark",
  "weekend-dark",
] as const;

const DARK_THEMES: ReadonlySet<ThemeName> = new Set(DARK_THEME_NAMES);

export function isThemeName(value: unknown): value is ThemeName {
  return (
    typeof value === "string" &&
    (THEME_NAMES as readonly string[]).includes(value)
  );
}

export function isDarkTheme(theme: ThemeName): boolean {
  return DARK_THEMES.has(theme);
}

/**
 * Weekend's four named themes. The shell writes one of these as
 * `<html data-theme="...">`; tokens.css has a `:root[data-theme="..."]` block
 * for each. Project apps don't manage themes — they observe via
 * `useShellTheme()` and style via `[data-theme="..."]` selectors or the
 * shell-toggled `.dark` / `.light` classes.
 */
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

const DARK_THEMES_INTERNAL: ReadonlySet<ThemeName> = new Set<ThemeName>([
  "fluid-dark",
  "weekend-dark",
]);

export const DARK_THEMES: ReadonlySet<ThemeName> = DARK_THEMES_INTERNAL;

export function isDarkTheme(theme: ThemeName): boolean {
  return DARK_THEMES_INTERNAL.has(theme);
}

export function isThemeName(value: unknown): value is ThemeName {
  return (
    typeof value === "string" &&
    (THEME_NAMES as readonly string[]).includes(value)
  );
}

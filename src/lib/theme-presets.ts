/**
 * Theme Presets - Brand hue definitions
 */

export const THEME_PRESETS = {
  default: {
    name: "Purple",
    hue: 250,
    description: "Default purple accent",
  },
  blue: {
    name: "Blue",
    hue: 220,
    description: "Cool blue accent",
  },
  green: {
    name: "Green",
    hue: 145,
    description: "Natural green accent",
  },
  orange: {
    name: "Orange",
    hue: 35,
    description: "Warm orange accent",
  },
  pink: {
    name: "Pink",
    hue: 330,
    description: "Vibrant pink accent",
  },
  custom: {
    name: "Custom",
    hue: null, // Uses customHue from context
    description: "Custom hue value",
  },
} as const;

export type ThemePreset = keyof typeof THEME_PRESETS;

/**
 * Get the hue value for a preset
 */
export function getPresetHue(preset: ThemePreset, customHue = 250): number {
  if (preset === "custom") {
    return customHue;
  }
  return THEME_PRESETS[preset].hue ?? 250;
}

/**
 * Apply a theme preset to the document
 */
export function applyThemePreset(preset: ThemePreset, customHue = 250): void {
  const hue = getPresetHue(preset, customHue);
  document.documentElement.style.setProperty("--brand-hue", String(hue));
}

/**
 * Get all preset options for display
 */
export function getPresetOptions(): Array<{
  value: ThemePreset;
  label: string;
  hue: number | null;
  description: string;
}> {
  return Object.entries(THEME_PRESETS).map(([key, config]) => ({
    value: key as ThemePreset,
    label: config.name,
    hue: config.hue,
    description: config.description,
  }));
}

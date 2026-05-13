import {
  safeLocalStorageGetItem,
  safeLocalStorageSetItem,
} from "@/lib/utils/safe-local-storage";
import {
  DARK_THEME_NAMES,
  DEFAULT_THEME,
  isDarkTheme,
  isThemeName,
  THEME_NAMES,
  THEME_STORAGE_KEY,
  type ThemeName,
} from "./theme-model";

export function readStoredTheme(): ThemeName {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const stored = safeLocalStorageGetItem(THEME_STORAGE_KEY);
  return isThemeName(stored) ? stored : DEFAULT_THEME;
}

export function applyThemeToDom(theme: ThemeName): void {
  const root = document.documentElement;
  root.dataset.theme = theme;

  const dark = isDarkTheme(theme);
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);

  safeLocalStorageSetItem(THEME_STORAGE_KEY, theme);
}

const THEME_SCRIPT_VALID_NAMES = THEME_NAMES.map((theme) => `'${theme}'`).join(
  ","
);
const THEME_SCRIPT_DARK_CHECK = DARK_THEME_NAMES.map(
  (theme) => `t === '${theme}'`
).join(" || ");

export const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('${THEME_STORAGE_KEY}') || '${DEFAULT_THEME}';
    var valid = [${THEME_SCRIPT_VALID_NAMES}];
    if (valid.indexOf(t) === -1) t = '${DEFAULT_THEME}';
    var root = document.documentElement;
    root.dataset.theme = t;
    var dark = ${THEME_SCRIPT_DARK_CHECK};
    root.classList.toggle('dark', dark);
    root.classList.toggle('light', !dark);
  } catch (e) {}
})();
`;

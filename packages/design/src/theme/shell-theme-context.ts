import { createContext } from "react";
import type { ThemeName } from "./constants";

/**
 * Context published by `<ShellThemeBridge>` and consumed by `useShellTheme`.
 * Kept in its own module so the hook can `import` the context without pulling
 * in the bridge component (avoids a server-render cost for projects that
 * read the theme from outside React's tree).
 */
export interface ShellThemeContextValue {
  theme: ThemeName;
}

export const ShellThemeContext = createContext<ShellThemeContextValue | null>(
  null
);

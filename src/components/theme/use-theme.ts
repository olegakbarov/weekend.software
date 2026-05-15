import { use } from "react";
import { ThemeContext } from "./theme-provider";

/**
 * Hook to access theme context
 */
export function useTheme() {
  const context = use(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

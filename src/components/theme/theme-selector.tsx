/**
 * ThemeSelector - 4-way theme picker.
 */
import { cn } from "@/lib/utils";
import { THEME_NAMES, type ThemeName } from "./theme-provider";
import { useTheme } from "./use-theme";

const THEME_LABELS: Record<ThemeName, string> = {
  fluid: "Fluid · light",
  "fluid-dark": "Fluid · dark",
  "weekend-dark": "Weekend · dark",
  "weekend-paper": "Weekend · paper",
};

interface ThemeSelectorProps {
  className?: string;
}

export function ThemeSelector({ className }: ThemeSelectorProps) {
  const { activeTheme, setActiveTheme } = useTheme();

  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      {THEME_NAMES.map((name) => (
        <button
          className={cn(
            "rounded border px-3 py-2 font-code text-xs transition-colors",
            activeTheme === name
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
          )}
          key={name}
          onClick={() => setActiveTheme(name)}
          type="button"
        >
          {THEME_LABELS[name]}
        </button>
      ))}
    </div>
  );
}

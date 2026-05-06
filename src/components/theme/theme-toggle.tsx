/**
 * ThemeToggle - Toggles between the dark and light variant of the current
 * theme family. `fluid` ↔ `fluid-dark`, `weekend-paper` ↔ `weekend-dark`.
 */
import { Moon, Sun } from "lucide-react";
import { Tooltip } from "@weekend/design/registry";
import { Button } from "@/components/ui/button";
import type { ThemeName } from "./theme-provider";
import { useTheme } from "./use-theme";

const FAMILY_TOGGLE: Record<ThemeName, ThemeName> = {
  fluid: "fluid-dark",
  "fluid-dark": "fluid",
  "weekend-dark": "weekend-paper",
  "weekend-paper": "weekend-dark",
};

export function ThemeToggle({ className }: { className?: string }) {
  const { activeTheme, setActiveTheme, isDark } = useTheme();

  const next = FAMILY_TOGGLE[activeTheme];
  const Icon = isDark ? Sun : Moon;

  return (
    <Tooltip content={`Theme: ${activeTheme}`}>
      <Button
        className={className}
        onClick={() => setActiveTheme(next)}
        size="icon-sm"
        variant="ghost"
      >
        <Icon className="size-4" />
      </Button>
    </Tooltip>
  );
}

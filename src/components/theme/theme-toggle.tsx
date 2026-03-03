/**
 * ThemeToggle - Simple theme mode toggle button
 */
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "./use-theme";

export function ThemeToggle({ className }: { className?: string }) {
  const { mode, setMode, resolvedMode } = useTheme();

  const cycleMode = () => {
    const modes: Array<"light" | "dark" | "system"> = [
      "light",
      "dark",
      "system",
    ];
    const currentIndex = mode ? modes.indexOf(mode) : 0;
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex];
    if (nextMode) {
      setMode(nextMode);
    }
  };

  const Icon =
    mode === "system" ? Monitor : resolvedMode === "dark" ? Moon : Sun;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className={className}
          onClick={cycleMode}
          size="icon-sm"
          variant="ghost"
        >
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Theme:{" "}
        {mode === "system"
          ? "System"
          : resolvedMode === "dark"
            ? "Dark"
            : "Light"}
      </TooltipContent>
    </Tooltip>
  );
}

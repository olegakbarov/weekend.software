/**
 * ThemeSelector - Full theme configuration panel with mode and preset options
 */
import { Monitor, Moon, Palette, Sun } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { getPresetOptions } from "@/lib/theme-presets";
import { cn } from "@/lib/utils";
import { useTheme } from "./use-theme";

interface ThemeSelectorProps {
  showPresets?: boolean;
  className?: string;
}

export function ThemeSelector({
  showPresets = true,
  className,
}: ThemeSelectorProps) {
  const { mode, setMode, preset, setPreset, customHue, setCustomHue } =
    useTheme();

  const presetOptions = getPresetOptions();
  const handleModeChange = (value: string) => {
    if (value === "light" || value === "dark" || value === "system") {
      setMode(value);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Mode Selection */}
      <div className="space-y-2">
        <Tabs onValueChange={handleModeChange} value={mode}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger className="gap-1.5 font-vcr text-xs" value="light">
              <Sun className="size-3.5" />
              Light
            </TabsTrigger>
            <TabsTrigger className="gap-1.5 font-vcr text-xs" value="dark">
              <Moon className="size-3.5" />
              Dark
            </TabsTrigger>
            <TabsTrigger className="gap-1.5 font-vcr text-xs" value="system">
              <Monitor className="size-3.5" />
              System
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Preset Selection */}
      {showPresets && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 font-medium text-sm">
            <Palette className="size-3.5" />
            Accent Color
          </label>
          <div className="grid grid-cols-3 gap-2">
            {presetOptions.map((option) => (
              <button
                className={cn(
                  "flex flex-col items-center gap-1 rounded border p-2 transition-colors",
                  preset === option.value
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                )}
                key={option.value}
                onClick={() => setPreset(option.value)}
              >
                {option.hue !== null ? (
                  <div
                    className="size-6 rounded-full"
                    style={{
                      backgroundColor: `oklch(0.65 0.2 ${option.hue})`,
                    }}
                  />
                ) : (
                  <div className="size-6 rounded-full bg-gradient-to-r from-red-500 via-green-500 to-blue-500" />
                )}
                <span className="text-xs">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom Hue Slider (when custom preset is selected) */}
      {showPresets && preset === "custom" && (
        <div className="space-y-2">
          <label className="font-medium text-sm">
            Custom Hue: {customHue}&deg;
          </label>
          <Slider
            className="w-full"
            max={360}
            min={0}
            onValueChange={(values) => {
              const [nextValue] = values;
              if (typeof nextValue === "number") {
                setCustomHue(Math.round(nextValue));
              }
            }}
            rangeClassName="bg-transparent"
            step={1}
            trackStyle={{
              background: `linear-gradient(to right,
                oklch(0.65 0.2 0),
                oklch(0.65 0.2 60),
                oklch(0.65 0.2 120),
                oklch(0.65 0.2 180),
                oklch(0.65 0.2 240),
                oklch(0.65 0.2 300),
                oklch(0.65 0.2 360)
              )`,
            }}
            value={[customHue]}
          />
          <div
            className="h-8 rounded border border-border"
            style={{
              backgroundColor: `oklch(0.65 0.2 ${customHue})`,
            }}
          />
        </div>
      )}
    </div>
  );
}

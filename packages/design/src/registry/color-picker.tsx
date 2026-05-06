"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "../lib/cn";
import { springs } from "../lib/springs";
import { BADGE_HEX, type BadgeColor } from "./badge";

/**
 * Simplified swatch-grid color picker. The legacy version is a 1700-line custom
 * picker with HSL sliders, hex input, eyedropper, and accent palette. This port
 * exposes the most common use case — choose one of the 17 design-system accent
 * colors. The full picker can be ported later.
 */

interface ColorPickerProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: BadgeColor;
  onChange: (color: BadgeColor) => void;
  /** Optional gray slot. Default true. */
  includeGray?: boolean;
}

const COLORS: ReadonlyArray<BadgeColor> = Object.keys(BADGE_HEX) as BadgeColor[];

const ColorPicker = forwardRef<HTMLDivElement, ColorPickerProps>(
  ({ value, onChange, includeGray = true, className, ...props }, ref) => {
    const visible = includeGray ? COLORS : COLORS.filter((c) => c !== "gray");
    return (
      <div
        ref={ref}
        role="radiogroup"
        aria-label="Color"
        className={cn("grid grid-cols-9 gap-2 max-w-[280px]", className)}
        {...props}
      >
        {visible.map((color) => {
          const isActive = value === color;
          const hex = BADGE_HEX[color];
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={color}
              onClick={() => onChange(color)}
              className={cn(
                "relative size-7 rounded-full border outline-none cursor-pointer",
                "transition-transform duration-80 hover:scale-110",
                "focus-visible:ring-2 focus-visible:ring-[#6B97FF]",
                isActive ? "border-foreground" : "border-border/40",
              )}
              style={{ background: hex }}
            >
              {isActive && (
                <motion.span
                  className="absolute inset-0 grid place-items-center"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={springs.fast}
                >
                  <Check
                    size={14}
                    strokeWidth={2.5}
                    color={isLight(hex) ? "#171717" : "#FAFAFA"}
                  />
                </motion.span>
              )}
            </button>
          );
        })}
      </div>
    );
  },
);
ColorPicker.displayName = "ColorPicker";

/** Rough YIQ luminance check — returns true if color is light enough that
 *  dark text reads better on top. */
function isLight(hex: string): boolean {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160;
}

export { ColorPicker };
export type { ColorPickerProps };

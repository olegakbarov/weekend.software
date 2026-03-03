import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  trackClassName?: string;
  trackStyle?: React.CSSProperties;
  rangeClassName?: string;
  rangeStyle?: React.CSSProperties;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(
  (
    {
      className,
      trackClassName,
      trackStyle,
      rangeClassName,
      rangeStyle,
      ...props
    },
    ref
  ) => (
    <SliderPrimitive.Root
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      ref={ref}
      {...props}
    >
      <SliderPrimitive.Track
        className={cn(
          "relative h-2 w-full grow overflow-hidden rounded-full bg-muted",
          trackClassName
        )}
        style={trackStyle}
      >
        <SliderPrimitive.Range
          className={cn("absolute h-full bg-primary", rangeClassName)}
          style={rangeStyle}
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className="block size-4 rounded-full border border-primary/60 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        data-slot="slider-thumb"
      />
    </SliderPrimitive.Root>
  )
);

Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };

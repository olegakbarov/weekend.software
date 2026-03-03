import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { primeSoundCueEngine, queueSoundCue } from "@/lib/audio/sound-cues";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium font-vcr text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-border bg-transparent hover:bg-secondary hover:text-foreground",
        ghost: "hover:bg-secondary hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-success text-white hover:bg-success/90",
      },
      size: {
        default: "h-9 px-4 py-2",
        lg: "h-11 px-6 py-3",
        sm: "h-8 px-3 text-xs",
        xs: "h-6 px-2 text-xs",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
        "icon-xs": "h-6 w-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  soundCue?: "default" | "none";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      soundCue = "default",
      onPointerDown,
      onClick,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    const handlePointerDown: ButtonHTMLAttributes<HTMLButtonElement>["onPointerDown"] =
      (event) => {
        onPointerDown?.(event);
        if (event.defaultPrevented) return;
        primeSoundCueEngine();
      };

    const handleClick: ButtonHTMLAttributes<HTMLButtonElement>["onClick"] = (
      event
    ) => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      if (props.disabled) return;
      if (soundCue === "none") return;
      queueSoundCue("click");
    };

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

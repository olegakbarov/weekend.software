import { forwardRef, type ButtonHTMLAttributes } from "react";
import {
  Button as DSButton,
  type ButtonSize as DSButtonSize,
  type ButtonVariant as DSButtonVariant,
} from "@weekend/design";
import { primeSoundCueEngine, queueSoundCue } from "@/lib/audio/sound-cues";
import { cn } from "@/lib/utils";

type WeekendVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "link"
  | "success";

type WeekendSize =
  | "default"
  | "lg"
  | "sm"
  | "xs"
  | "icon"
  | "icon-sm"
  | "icon-xs";

const VARIANT_MAP: Record<WeekendVariant, DSButtonVariant> = {
  default: "primary",
  secondary: "secondary",
  destructive: "destructive",
  outline: "tertiary",
  ghost: "ghost",
  link: "link",
  success: "success",
};

const NON_ICON_SIZE_MAP: Record<
  Exclude<WeekendSize, "icon" | "icon-sm" | "icon-xs">,
  DSButtonSize
> = {
  default: "md",
  lg: "lg",
  sm: "sm",
  xs: "xs",
};

const ICON_SIZE_CLASSES: Record<"icon" | "icon-sm" | "icon-xs", string> = {
  icon: "h-9 w-9 px-0",
  "icon-sm": "h-8 w-8 px-0",
  "icon-xs": "h-6 w-6 px-0",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: WeekendVariant;
  size?: WeekendSize;
  asChild?: boolean;
  soundCue?: "default" | "none";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "default",
      size = "default",
      asChild = false,
      soundCue = "default",
      onPointerDown,
      onClick,
      className,
      ...props
    },
    ref,
  ) => {
    const handlePointerDown: React.PointerEventHandler<HTMLButtonElement> = (event) => {
      onPointerDown?.(event);
      if (event.defaultPrevented) return;
      primeSoundCueEngine();
    };

    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      if (props.disabled) return;
      if (soundCue === "none") return;
      queueSoundCue("click");
    };

    const isIconSize = size === "icon" || size === "icon-sm" || size === "icon-xs";
    const dsSize: DSButtonSize = isIconSize
      ? "md"
      : NON_ICON_SIZE_MAP[size];

    return (
      <DSButton
        ref={ref}
        variant={VARIANT_MAP[variant]}
        size={dsSize}
        asChild={asChild}
        className={cn(isIconSize && ICON_SIZE_CLASSES[size], className)}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };

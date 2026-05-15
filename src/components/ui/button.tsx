import type { ButtonHTMLAttributes, Ref } from "react";
import {
  Button as DSButton,
  type ButtonSize as DSButtonSize,
  type ButtonVariant as DSButtonVariant,
} from "@weekend/design";
import type { IconComponent } from "@weekend/design";
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
  icon: "size-9 px-0",
  "icon-sm": "size-8 px-0",
  "icon-xs": "size-6 px-0",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: WeekendVariant;
  size?: WeekendSize;
  asChild?: boolean;
  ref?: Ref<HTMLButtonElement>;
  soundCue?: "default" | "none";
  /** Icon rendered before children. Passing as a prop (instead of as a child)
   * keeps the icon and text as sibling flex items so they align horizontally
   * — passing the icon as a child stacks it above the text because Tailwind
   * preflight sets `svg { display: block }`. */
  icon?: IconComponent;
  /** Icon rendered after children. Same alignment rationale as `icon`. */
  trailingIcon?: IconComponent;
  /** Swaps content for the design-system spinner and disables the button. */
  loading?: boolean;
}

function Button({
  variant = "default",
  size = "default",
  asChild = false,
  soundCue = "default",
  onPointerDown,
  onClick,
  className,
  ref,
  ...props
}: ButtonProps) {
  const primeButtonSound: React.PointerEventHandler<HTMLButtonElement> = (event) => {
    onPointerDown?.(event);
    if (event.defaultPrevented) return;
    primeSoundCueEngine();
  };

  const playButtonClickCue: React.MouseEventHandler<HTMLButtonElement> = (event) => {
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
      onClick={playButtonClickCue}
      onPointerDown={primeButtonSound}
      {...props}
    />
  );
}
Button.displayName = "Button";

export { Button };

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "../lib/cn";
import type { IconComponent } from "../lib/icon";
import "./button.css";

export type ButtonVariant = "primary" | "tertiary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconComponent;
  trailingIcon?: IconComponent;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "tertiary",
    size = "md",
    icon: Icon,
    trailingIcon: TrailingIcon,
    children,
    className,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn("btn", `btn-${variant}`, size !== "md" && `btn-${size}`, className)}
      {...props}
    >
      <span className="btn-bg" aria-hidden="true" />
      {Icon ? <Icon /> : null}
      {children != null ? <span>{children}</span> : null}
      {TrailingIcon ? <TrailingIcon /> : null}
    </button>
  );
});

export interface IconButtonProps extends ComponentPropsWithoutRef<"button"> {
  icon: IconComponent;
  /** Accessible label — also used as the tooltip. */
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn("btn-icon", className)}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon />
    </button>
  );
});

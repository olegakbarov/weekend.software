import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "../lib/cn";
import type { IconComponent } from "../lib/icon";
import "./button.css";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "ghost"
  | "destructive"
  | "success"
  | "link";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconComponent;
  trailingIcon?: IconComponent;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "tertiary",
    size = "md",
    icon: Icon,
    trailingIcon: TrailingIcon,
    asChild = false,
    children,
    className,
    type = "button",
    ...props
  },
  ref,
) {
  const classes = cn("btn", `btn-${variant}`, size !== "md" && `btn-${size}`, className);

  if (asChild) {
    // When asChild, render as Slot. The consumer's child element receives the
    // className and props directly. We skip the .btn-bg overlay and icon slots
    // here because Slot requires a single child — asChild is intended for
    // simple wrappers (e.g. `<Link>`) where the consumer renders their own
    // content. Hover/active styling still works since .btn-bg is not required
    // for variants that color the element directly (the overlay is mostly a
    // hover-transition niceity for solid variants).
    return (
      <Slot ref={ref} className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      {...props}
    >
      <span className="btn-bg" aria-hidden="true" />
      {Icon ? <Icon /> : null}
      {children != null ? <span>{children}</span> : null}
      {TrailingIcon ? <TrailingIcon /> : null}
    </button>
  );
});

export type IconButtonSize = "xs" | "sm" | "md" | "lg";

export interface IconButtonProps extends ComponentPropsWithoutRef<"button"> {
  icon: IconComponent;
  /** Accessible label — also used as the tooltip. */
  label: string;
  size?: IconButtonSize;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, size = "md", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn("btn-icon", `btn-icon-${size}`, className)}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon />
    </button>
  );
});

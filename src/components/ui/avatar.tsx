import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const Avatar = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Avatar.displayName = "Avatar";

const AvatarFallback = forwardRef<
  HTMLSpanElement,
  HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    ref={ref}
    {...props}
  />
));
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarFallback };

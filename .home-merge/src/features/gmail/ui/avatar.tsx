import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "~/lib/utils";

export const GmailAvatar = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      className={cn("relative flex size-9 shrink-0 overflow-hidden rounded-full", className)}
      ref={ref}
      {...props}
    />
  )
);
GmailAvatar.displayName = "GmailAvatar";

export const GmailAvatarFallback = forwardRef<
  HTMLSpanElement,
  HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    className={cn(
      "flex size-full items-center justify-center rounded-full bg-muted text-xs font-medium",
      className
    )}
    ref={ref}
    {...props}
  />
));
GmailAvatarFallback.displayName = "GmailAvatarFallback";

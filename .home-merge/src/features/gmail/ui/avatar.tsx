import type { HTMLAttributes, Ref } from "react";
import { cn } from "~/lib/utils";

type GmailAvatarProps = HTMLAttributes<HTMLSpanElement> & {
  ref?: Ref<HTMLSpanElement>;
};

export function GmailAvatar({ className, ref, ...props }: GmailAvatarProps) {
  return (
    <span
      className={cn(
        "relative flex size-9 shrink-0 overflow-hidden rounded-full",
        className
      )}
      ref={ref}
      {...props}
    />
  );
}
GmailAvatar.displayName = "GmailAvatar";

export function GmailAvatarFallback({
  className,
  ref,
  ...props
}: GmailAvatarProps) {
  return (
    <span
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-xs font-medium",
        className
      )}
      ref={ref}
      {...props}
    />
  );
}
GmailAvatarFallback.displayName = "GmailAvatarFallback";

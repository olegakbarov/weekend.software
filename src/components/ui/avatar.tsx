import type { HTMLAttributes, Ref } from "react";
import { cn } from "../../lib/utils";

type AvatarProps = HTMLAttributes<HTMLSpanElement> & {
  ref?: Ref<HTMLSpanElement>;
};

function Avatar({ className, ref, ...props }: AvatarProps) {
  return (
    <span
      className={cn(
        "relative flex size-10 shrink-0 overflow-hidden rounded-full",
        className
      )}
      ref={ref}
      {...props}
    />
  );
}
Avatar.displayName = "Avatar";

function AvatarFallback({ className, ref, ...props }: AvatarProps) {
  return (
    <span
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-muted",
        className
      )}
      ref={ref}
      {...props}
    />
  );
}
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarFallback };

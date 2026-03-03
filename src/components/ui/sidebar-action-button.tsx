import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "./button";

const SidebarActionButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => (
    <Button
      className={cn("h-10 w-full justify-center gap-2 text-xs", className)}
      ref={ref}
      {...props}
    />
  )
);
SidebarActionButton.displayName = "SidebarActionButton";

export { SidebarActionButton };

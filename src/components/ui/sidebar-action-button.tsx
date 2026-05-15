import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "./button";

function SidebarActionButton({ className, ref, ...props }: ButtonProps) {
  return (
    <Button
      className={cn("h-10 w-full justify-center gap-2 text-xs", className)}
      ref={ref}
      {...props}
    />
  );
}
SidebarActionButton.displayName = "SidebarActionButton";

export { SidebarActionButton };

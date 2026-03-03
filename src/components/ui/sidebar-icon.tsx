import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

interface SidebarIconProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  className?: string;
  dataTestId?: string;
}

export function SidebarIcon({
  icon: Icon,
  label,
  onClick,
  active = false,
  className,
  dataTestId,
}: SidebarIconProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={label}
          className={cn(
            "shrink-0 p-1 transition-colors",
            active
              ? "text-foreground"
              : "text-muted-foreground/40 hover:text-foreground",
            className
          )}
          data-testid={dataTestId}
          onClick={onClick}
          type="button"
        >
          <Icon className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <span className="font-vcr text-[12px]">{label.toUpperCase()}</span>
      </TooltipContent>
    </Tooltip>
  );
}

import { cn } from "~/lib/cn";
import { format, parseISO, getMultiDayPosition } from "~/lib/calendar-utils";
import type { CalendarEvent } from "~/lib/calendar-types";
import { colorStyles, dotColors } from "~/lib/event-colors";

interface EventBadgeProps {
  event: CalendarEvent;
  date: Date;
}

export function EventBadge({ event, date }: EventBadgeProps) {
  const position = getMultiDayPosition(event, date);
  const showContent = position === "first" || position === "none";
  const time = format(parseISO(event.startDate), "h:mm a");

  return (
    <div
      className={cn(
        "flex h-[26px] items-center gap-1.5 border px-2 text-xs",
        colorStyles[event.color],
        position === "none" && "rounded-md",
        position === "first" && "rounded-l-md border-r-0 pr-0",
        position === "middle" && "-mx-px border-x-0",
        position === "last" && "rounded-r-md border-l-0 pl-0"
      )}
    >
      {showContent && (
        <>
          <span
            className={cn(
              "event-dot size-1.5 shrink-0 rounded-full",
              dotColors[event.color]
            )}
          />
          <span className="truncate font-medium">{event.title}</span>
          <span className="shrink-0 text-[10px] opacity-70">{time}</span>
        </>
      )}
    </div>
  );
}

export function EventBullet({ color }: { color: string }) {
  return (
    <span className={cn("size-2 rounded-full", dotColors[color] || dotColors.gray)} />
  );
}

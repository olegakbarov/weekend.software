import { cn } from "~/lib/cn";
import { isSameDay, getEventsForDay } from "~/lib/calendar-utils";
import type {
  CalendarCell,
  CalendarEvent,
  CalendarEventId,
} from "~/lib/calendar-types";
import { EventBadge, EventBullet } from "./event-badge";

interface DayCellProps {
  cell: CalendarCell;
  events: CalendarEvent[];
  eventPositions: Map<CalendarEventId, number>;
  today: Date;
}

export function DayCell({ cell, events, eventPositions, today }: DayCellProps) {
  const dayEvents = getEventsForDay(events, cell.date);
  const isToday = isSameDay(cell.date, today);

  // Build slots array (0, 1, 2)
  const slots: (CalendarEvent | null)[] = [null, null, null];
  const overflow: CalendarEvent[] = [];

  for (const event of dayEvents) {
    const pos = eventPositions.get(event.id) ?? -1;
    if (pos >= 0 && pos < 3) {
      slots[pos] = event;
    } else {
      overflow.push(event);
    }
  }

  const overflowCount = overflow.length;

  return (
    <div
      className={cn(
        "min-h-[120px] border-b border-r border-cal-border p-1",
        !cell.currentMonth && "bg-cal-dim"
      )}
    >
      {/* Day number */}
      <div className="mb-1 flex justify-center">
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-full text-sm",
            isToday && "bg-cal-accent font-bold text-cal-accent-text",
            !isToday && cell.currentMonth && "text-cal-text",
            !cell.currentMonth && "text-cal-text-faint"
          )}
        >
          {cell.day}
        </span>
      </div>

      {/* Mobile dots */}
      <div className="flex flex-wrap gap-0.5 lg:hidden">
        {dayEvents.slice(0, 5).map((event) => (
          <EventBullet key={event.id} color={event.color} />
        ))}
      </div>

      {/* Desktop event badges */}
      <div className="hidden flex-col gap-0.5 lg:flex">
        {slots.map((event, i) =>
          event ? (
            <EventBadge
              key={event.id}
              event={event}
              date={cell.date}
            />
          ) : (
            <div key={`empty-${i}`} className="h-[26px]" />
          )
        )}
        {overflowCount > 0 && (
          <span
            className={cn(
              "mt-0.5 px-2 text-[11px] text-cal-text-muted",
              !cell.currentMonth && "opacity-50"
            )}
          >
            +{overflowCount} more...
          </span>
        )}
      </div>
    </div>
  );
}

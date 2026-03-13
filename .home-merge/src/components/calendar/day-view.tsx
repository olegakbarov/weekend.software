import { cn } from "~/lib/cn";
import {
  format,
  parseISO,
  getEventsForDay,
  getHours,
  getMinutes,
  differenceInMinutes,
  isSameDay,
} from "~/lib/calendar-utils";
import type { CalendarEvent } from "~/lib/calendar-types";
import { colorStyles } from "~/lib/event-colors";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
}

export function DayView({ currentDate, events }: DayViewProps) {
  const dayEvents = getEventsForDay(events, currentDate);
  const isToday = isSameDay(currentDate, new Date());

  // Separate all-day / multi-day events from timed events
  const allDayEvents: CalendarEvent[] = [];
  const timedEvents: CalendarEvent[] = [];

  for (const event of dayEvents) {
    const start = parseISO(event.startDate);
    const end = parseISO(event.endDate);
    if (!isSameDay(start, end)) {
      allDayEvents.push(event);
    } else {
      timedEvents.push(event);
    }
  }

  return (
    <div>
      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="border-b border-cal-border px-4 py-2">
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-cal-text-dimmed">
            All Day
          </div>
          <div className="flex flex-wrap gap-1">
            {allDayEvents.map((event) => (
              <div
                key={event.id}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs font-medium",
                  colorStyles[event.color]
                )}
              >
                {event.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div className="relative flex">
        {/* Time labels */}
        <div className="w-16 shrink-0 border-r border-cal-border">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="relative h-14 border-b border-cal-border/50"
            >
              <span className="absolute -top-2.5 right-2 text-[11px] text-cal-text-dimmed">
                {hour === 0
                  ? "12 AM"
                  : hour < 12
                    ? `${hour} AM`
                    : hour === 12
                      ? "12 PM"
                      : `${hour - 12} PM`}
              </span>
            </div>
          ))}
        </div>

        {/* Day column */}
        <div className="relative flex-1">
          {/* Hour lines */}
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="h-14 border-b border-cal-border/50"
            />
          ))}

          {/* Current time indicator */}
          {isToday && <CurrentTimeIndicator />}

          {/* Events */}
          {timedEvents.map((event) => {
            const start = parseISO(event.startDate);
            const end = parseISO(event.endDate);
            const startHour = getHours(start) + getMinutes(start) / 60;
            const duration = Math.max(differenceInMinutes(end, start) / 60, 0.5);
            const top = startHour * 56; // 56px = h-14
            const height = duration * 56;

            return (
              <div
                key={event.id}
                className={cn(
                  "absolute left-1 right-1 overflow-hidden rounded-md border px-2 py-1",
                  colorStyles[event.color]
                )}
                style={{ top: `${top}px`, height: `${Math.max(height, 24)}px` }}
              >
                <div className="text-xs font-medium">{event.title}</div>
                <div className="text-[10px] opacity-70">
                  {format(start, "h:mm a")} - {format(end, "h:mm a")}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CurrentTimeIndicator() {
  const now = new Date();
  const top = (getHours(now) + getMinutes(now) / 60) * 56;

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
      style={{ top: `${top}px` }}
    >
      <div className="size-2 rounded-full bg-red-500" />
      <div className="h-px flex-1 bg-red-500" />
    </div>
  );
}

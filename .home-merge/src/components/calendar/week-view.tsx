import { cn } from "~/lib/cn";
import {
  format,
  parseISO,
  getWeekDays,
  getEventsForDay,
  getHours,
  getMinutes,
  differenceInMinutes,
  isSameDay,
} from "~/lib/calendar-utils";
import type { CalendarEvent } from "~/lib/calendar-types";
import { colorStyles } from "~/lib/event-colors";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
}

export function WeekView({ currentDate, events }: WeekViewProps) {
  const weekDays = getWeekDays(currentDate);
  const today = new Date();

  // Collect all-day events per day
  const allDayEventsMap = new Map<string, CalendarEvent[]>();
  let hasAllDay = false;

  for (const day of weekDays) {
    const dayEvents = getEventsForDay(events, day);
    const allDay = dayEvents.filter((e) => {
      const start = parseISO(e.startDate);
      const end = parseISO(e.endDate);
      return !isSameDay(start, end);
    });
    if (allDay.length > 0) hasAllDay = true;
    allDayEventsMap.set(format(day, "yyyy-MM-dd"), allDay);
  }

  return (
    <div>
      {/* All-day row */}
      {hasAllDay && (
        <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-cal-border">
          <div className="flex items-center justify-end border-r border-cal-border px-2 py-1">
            <span className="text-[11px] text-cal-text-dimmed">All Day</span>
          </div>
          {weekDays.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayAllDay = allDayEventsMap.get(key) || [];
            return (
              <div
                key={key}
                className="min-h-[32px] border-r border-cal-border px-0.5 py-0.5 last:border-r-0"
              >
                {dayAllDay.map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      "mb-0.5 truncate rounded border px-1 py-0.5 text-[10px] font-medium",
                      colorStyles[event.color]
                    )}
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Column headers */}
      <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-cal-border">
        <div className="border-r border-cal-border" />
        {weekDays.map((day) => {
          const isCurrentDay = isSameDay(day, today);
          return (
            <div
              key={day.toISOString()}
              className="border-r border-cal-border px-2 py-2 text-center last:border-r-0"
            >
              <div className="text-[11px] font-medium uppercase tracking-wider text-cal-text-dimmed">
                {format(day, "EEE")}
              </div>
              <div
                className={cn(
                  "mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm",
                  isCurrentDay && "bg-cal-accent font-bold text-cal-accent-text",
                  !isCurrentDay && "text-cal-text"
                )}
              >
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="relative grid grid-cols-[64px_repeat(7,1fr)]">
        {/* Time labels */}
        <div className="border-r border-cal-border">
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

        {/* Day columns */}
        {weekDays.map((day) => {
          const isCurrentDay = isSameDay(day, today);
          const dayEvents = getEventsForDay(events, day).filter((e) => {
            const start = parseISO(e.startDate);
            const end = parseISO(e.endDate);
            return isSameDay(start, end);
          });

          return (
            <div
              key={day.toISOString()}
              className="relative border-r border-cal-border last:border-r-0"
            >
              {/* Hour lines */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="h-14 border-b border-cal-border/50"
                />
              ))}

              {/* Current time indicator */}
              {isCurrentDay && <CurrentTimeIndicator />}

              {/* Events */}
              {dayEvents.map((event) => {
                const start = parseISO(event.startDate);
                const end = parseISO(event.endDate);
                const startHour =
                  getHours(start) + getMinutes(start) / 60;
                const duration = Math.max(
                  differenceInMinutes(end, start) / 60,
                  0.5
                );
                const top = startHour * 56;
                const height = duration * 56;

                return (
                  <div
                    key={event.id}
                    className={cn(
                      "absolute left-0.5 right-0.5 overflow-hidden rounded border px-1 py-0.5",
                      colorStyles[event.color]
                    )}
                    style={{
                      top: `${top}px`,
                      height: `${Math.max(height, 20)}px`,
                    }}
                  >
                    <div className="truncate text-[10px] font-medium">
                      {event.title}
                    </div>
                    {height >= 36 && (
                      <div className="truncate text-[9px] opacity-70">
                        {format(start, "h:mm a")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
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

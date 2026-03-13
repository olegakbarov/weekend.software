import { cn } from "~/lib/cn";
import {
  format,
  parseISO,
  isSameDay,
  startOfMonth,
  endOfMonth,
} from "~/lib/calendar-utils";
import type { CalendarEvent } from "~/lib/calendar-types";
import { colorStyles, dotColors } from "~/lib/event-colors";

interface AgendaViewProps {
  currentDate: Date;
  events: CalendarEvent[];
}

export function AgendaView({ currentDate, events }: AgendaViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const today = new Date();

  // Filter and sort events within the current month
  const monthEvents = events
    .filter((event) => {
      const start = parseISO(event.startDate);
      const end = parseISO(event.endDate);
      return start <= monthEnd && end >= monthStart;
    })
    .sort(
      (a, b) =>
        parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
    );

  // Group events by date
  const grouped = new Map<string, CalendarEvent[]>();
  for (const event of monthEvents) {
    const key = format(parseISO(event.startDate), "yyyy-MM-dd");
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(event);
  }

  const sortedDates = Array.from(grouped.keys()).sort();

  if (sortedDates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-cal-text-dimmed">
        <svg
          className="mb-3 size-12 text-cal-text-faint"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <p className="text-sm">No events this month</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-cal-border">
      {sortedDates.map((dateKey) => {
        const date = parseISO(dateKey);
        const dayEvents = grouped.get(dateKey)!;
        const isToday = isSameDay(date, today);

        return (
          <div key={dateKey} className="flex gap-4 px-4 py-3">
            {/* Date column */}
            <div className="w-16 shrink-0 pt-0.5">
              <div
                className={cn(
                  "text-center",
                  isToday && "text-cal-accent",
                  !isToday && "text-cal-text-muted"
                )}
              >
                <div className="text-[11px] font-medium uppercase tracking-wider">
                  {format(date, "EEE")}
                </div>
                <div
                  className={cn(
                    "mx-auto mt-0.5 flex size-8 items-center justify-center rounded-full text-lg font-semibold",
                    isToday && "bg-cal-accent text-cal-accent-text"
                  )}
                >
                  {format(date, "d")}
                </div>
              </div>
            </div>

            {/* Events list */}
            <div className="flex flex-1 flex-col gap-1.5">
              {dayEvents.map((event) => {
                const start = parseISO(event.startDate);
                const end = parseISO(event.endDate);
                const isMultiDay = !isSameDay(start, end);

                return (
                  <div
                    key={event.id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border px-3 py-2",
                      colorStyles[event.color]
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1 size-2 shrink-0 rounded-full",
                        dotColors[event.color]
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{event.title}</div>
                      <div className="mt-0.5 text-xs opacity-70">
                        {isMultiDay
                          ? `${format(start, "MMM d, h:mm a")} - ${format(end, "MMM d, h:mm a")}`
                          : `${format(start, "h:mm a")} - ${format(end, "h:mm a")}`}
                      </div>
                      {event.description && (
                        <div className="mt-1 text-xs opacity-50">
                          {event.description}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

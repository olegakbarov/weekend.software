import { cn } from "~/lib/cn";
import {
  format,
  getCalendarCells,
  getEventsForDay,
  isSameDay,
  isSameMonth,
} from "~/lib/calendar-utils";
import type { CalendarEvent } from "~/lib/calendar-types";
import { dotColors } from "~/lib/event-colors";

const MINI_WEEKDAYS = [
  { key: "sun", label: "S" },
  { key: "mon", label: "M" },
  { key: "tue", label: "T" },
  { key: "wed", label: "W" },
  { key: "thu", label: "T" },
  { key: "fri", label: "F" },
  { key: "sat", label: "S" },
];

interface YearViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onMonthClick: (date: Date) => void;
}

export function YearView({ currentDate, events, onMonthClick }: YearViewProps) {
  const year = currentDate.getFullYear();
  const today = new Date();
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));

  return (
    <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3 lg:grid-cols-4">
      {months.map((month) => (
        <MiniMonth
          key={month.getMonth()}
          month={month}
          events={events}
          today={today}
          onMonthClick={onMonthClick}
        />
      ))}
    </div>
  );
}

function MiniMonth({
  month,
  events,
  today,
  onMonthClick,
}: {
  month: Date;
  events: CalendarEvent[];
  today: Date;
  onMonthClick: (date: Date) => void;
}) {
  const cells = getCalendarCells(month);

  return (
    <button
      className="cursor-pointer rounded-lg border border-cal-border p-3 transition-colors hover:border-cal-border-strong hover:bg-cal-surface/50"
      onClick={() => onMonthClick(month)}
      type="button"
    >
      {/* Month name */}
      <div className="mb-2 text-sm font-semibold text-cal-text">
        {format(month, "MMMM")}
      </div>

      {/* Weekday header */}
      <div className="mb-1 grid grid-cols-7 gap-0">
        {MINI_WEEKDAYS.map((day) => (
          <div
            key={day.key}
            className="text-center text-[9px] font-medium text-cal-text-faint"
          >
            {day.label}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-0">
        {cells.map((cell) => {
          const isCurrentMonth = isSameMonth(cell.date, month);
          const isCurrentDay = isSameDay(cell.date, today);
          const dayEvents = isCurrentMonth
            ? getEventsForDay(events, cell.date)
            : [];
          const hasEvents = dayEvents.length > 0;

          return (
            <div
              key={cell.date.toISOString()}
              className="flex flex-col items-center py-0.5"
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[10px]",
                  !isCurrentMonth && "text-transparent",
                  isCurrentMonth && !isCurrentDay && "text-cal-text-muted",
                  isCurrentDay && "bg-cal-primary font-bold text-cal-primary-text"
                )}
              >
                {cell.day}
              </span>
              {isCurrentMonth && hasEvents && (
                <div className="mt-px flex gap-px">
                  {dayEvents.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className={cn(
                        "size-1 rounded-full",
                        dotColors[e.color] || dotColors.gray
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </button>
  );
}

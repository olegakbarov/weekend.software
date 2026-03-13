import {
  getCalendarCells,
  calculateEventPositions,
} from "~/lib/calendar-utils";
import type { CalendarEvent } from "~/lib/calendar-types";
import { DayCell } from "./day-cell";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
}

export function MonthView({ currentDate, events }: MonthViewProps) {
  const today = new Date();
  const cells = getCalendarCells(currentDate);
  const eventPositions = calculateEventPositions(events, cells);

  return (
    <div>
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-cal-border">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="border-r border-cal-border px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-cal-text-dimmed last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => (
          <DayCell
            key={`${cell.date.toISOString()}-${i}`}
            cell={cell}
            events={events}
            eventPositions={eventPositions}
            today={today}
          />
        ))}
      </div>
    </div>
  );
}

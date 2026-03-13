import { useMemo } from "react";
import { cn } from "~/lib/utils";

type CalendarCell = {
  day: number | null;
  isToday: boolean;
};

const weekdayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function MiniCalendar() {
  const today = new Date();

  const { monthLabel, cells } = useMemo(() => {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const daysInMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    ).getDate();

    const calendarCells: CalendarCell[] = [];

    for (let index = 0; index < monthStart.getDay(); index += 1) {
      calendarCells.push({ day: null, isToday: false });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      calendarCells.push({
        day,
        isToday: day === today.getDate(),
      });
    }

    while (calendarCells.length % 7 !== 0) {
      calendarCells.push({ day: null, isToday: false });
    }

    return {
      monthLabel: new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
      }).format(today),
      cells: calendarCells,
    };
  }, [today]);

  return (
    <div className="w-[260px] rounded-md border bg-background p-3">
      <div className="mb-3 text-center text-sm font-medium">{monthLabel}</div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {weekdayLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell, index) => (
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md text-xs",
              cell.day == null && "text-transparent",
              cell.day != null && "hover:bg-accent",
              cell.isToday && "bg-accent text-accent-foreground"
            )}
            key={`${cell.day ?? "blank"}-${index}`}
          >
            {cell.day ?? ""}
          </div>
        ))}
      </div>
    </div>
  );
}

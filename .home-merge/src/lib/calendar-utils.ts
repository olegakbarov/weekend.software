import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  startOfYear,
  eachDayOfInterval,
  eachMonthOfInterval,
  isSameMonth,
  isSameDay,
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  addYears,
  subYears,
  parseISO,
  isWithinInterval,
  differenceInDays,
  differenceInMinutes,
  getHours,
  getMinutes,
  setHours,
  setMinutes,
} from "date-fns";
import type {
  CalendarCell,
  CalendarEvent,
  CalendarEventId,
} from "./calendar-types";

export function getCalendarCells(date: Date): CalendarCell[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return days.map((d) => ({
    day: d.getDate(),
    currentMonth: isSameMonth(d, date),
    date: d,
  }));
}

export function getEventsForDay(
  events: CalendarEvent[],
  date: Date
): CalendarEvent[] {
  return events.filter((event) => {
    const start = parseISO(event.startDate);
    const end = parseISO(event.endDate);
    return (
      isSameDay(date, start) ||
      isSameDay(date, end) ||
      isWithinInterval(date, { start, end })
    );
  });
}

export function calculateEventPositions(
  events: CalendarEvent[],
  cells: CalendarCell[]
): Map<CalendarEventId, number> {
  const positions = new Map<CalendarEventId, number>();

  // Separate multi-day and single-day events
  const multiDay: CalendarEvent[] = [];
  const singleDay: CalendarEvent[] = [];

  for (const event of events) {
    const start = parseISO(event.startDate);
    const end = parseISO(event.endDate);
    if (isSameDay(start, end)) {
      singleDay.push(event);
    } else {
      multiDay.push(event);
    }
  }

  // Sort multi-day by duration (longest first)
  multiDay.sort((a, b) => {
    const durA = differenceInDays(parseISO(a.endDate), parseISO(a.startDate));
    const durB = differenceInDays(parseISO(b.endDate), parseISO(b.startDate));
    return durB - durA;
  });

  // Sort single-day by start date
  singleDay.sort(
    (a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
  );

  const allSorted = [...multiDay, ...singleDay];

  // Track occupied slots per day (key: dateString, value: Set of slot numbers)
  const occupiedSlots = new Map<string, Set<number>>();

  for (const event of allSorted) {
    const start = parseISO(event.startDate);
    const end = parseISO(event.endDate);
    const eventDays = eachDayOfInterval({ start, end });

    // Find first available slot across all days of this event
    let slot = -1;
    for (let s = 0; s < 3; s++) {
      const canFit = eventDays.every((day) => {
        const key = format(day, "yyyy-MM-dd");
        const taken = occupiedSlots.get(key) || new Set();
        return !taken.has(s);
      });
      if (canFit) {
        slot = s;
        break;
      }
    }

    if (slot >= 0) {
      positions.set(event.id, slot);
      for (const day of eventDays) {
        const key = format(day, "yyyy-MM-dd");
        if (!occupiedSlots.has(key)) {
          occupiedSlots.set(key, new Set());
        }
        occupiedSlots.get(key)!.add(slot);
      }
    } else {
      positions.set(event.id, -1);
    }
  }

  return positions;
}

export function getMultiDayPosition(
  event: CalendarEvent,
  date: Date
): "first" | "middle" | "last" | "none" {
  const start = parseISO(event.startDate);
  const end = parseISO(event.endDate);

  if (isSameDay(start, end)) return "none";
  if (isSameDay(date, start)) return "first";
  if (isSameDay(date, end)) return "last";
  return "middle";
}

export function getWeekDays(date: Date): Date[] {
  const weekStart = startOfWeek(date, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
  return eachDayOfInterval({ start: weekStart, end: weekEnd });
}

export function getEventTimePosition(event: CalendarEvent): {
  top: number;
  height: number;
} {
  const start = parseISO(event.startDate);
  const end = parseISO(event.endDate);
  const startHour = getHours(start) + getMinutes(start) / 60;
  const duration = differenceInMinutes(end, start) / 60;
  return {
    top: startHour,
    height: Math.max(duration, 0.5),
  };
}

export function getMonthsOfYear(date: Date): Date[] {
  const yearStart = startOfYear(date);
  const yearEnd = new Date(date.getFullYear(), 11, 31);
  return eachMonthOfInterval({ start: yearStart, end: yearEnd });
}

export function getEventsInRange(
  events: CalendarEvent[],
  start: Date,
  end: Date
): CalendarEvent[] {
  return events.filter((event) => {
    const eventStart = parseISO(event.startDate);
    const eventEnd = parseISO(event.endDate);
    return (
      isWithinInterval(eventStart, { start, end }) ||
      isWithinInterval(eventEnd, { start, end }) ||
      (eventStart <= start && eventEnd >= end)
    );
  });
}

export {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  addYears,
  subYears,
  startOfMonth,
  startOfWeek,
  startOfDay,
  endOfMonth,
  endOfWeek,
  isSameMonth,
  isSameDay,
  parseISO,
  getHours,
  getMinutes,
  differenceInMinutes,
};

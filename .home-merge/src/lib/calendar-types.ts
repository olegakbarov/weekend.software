export type EventColor =
  | "blue"
  | "green"
  | "red"
  | "yellow"
  | "purple"
  | "orange"
  | "gray";

export type CalendarView = "day" | "week" | "month" | "year" | "agenda";

export type CalendarEventId = string | number;

export interface CalendarEvent {
  id: CalendarEventId;
  title: string;
  startDate: string;
  endDate: string;
  color: EventColor;
  description: string;
}

export interface CalendarCell {
  day: number;
  currentMonth: boolean;
  date: Date;
}

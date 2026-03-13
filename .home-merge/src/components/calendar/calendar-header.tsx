import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
} from "~/lib/calendar-utils";
import { useTheme } from "~/lib/theme";
import type { CalendarEvent, CalendarView } from "~/lib/calendar-types";

interface CalendarHeaderProps {
  currentDate: Date;
  view: CalendarView;
  events: CalendarEvent[];
  onViewChange: (view: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

const views: { key: CalendarView; label: string; icon: React.ReactNode }[] = [
  {
    key: "day",
    label: "Day",
    icon: (
      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  {
    key: "week",
    label: "Week",
    icon: (
      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 4v16M15 4v16" />
      </svg>
    ),
  },
  {
    key: "month",
    label: "Month",
    icon: (
      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    key: "year",
    label: "Year",
    icon: (
      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="2" width="5" height="5" rx="0.5" />
        <rect x="9.5" y="2" width="5" height="5" rx="0.5" />
        <rect x="17" y="2" width="5" height="5" rx="0.5" />
        <rect x="2" y="9.5" width="5" height="5" rx="0.5" />
        <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
        <rect x="17" y="9.5" width="5" height="5" rx="0.5" />
        <rect x="2" y="17" width="5" height="5" rx="0.5" />
        <rect x="9.5" y="17" width="5" height="5" rx="0.5" />
        <rect x="17" y="17" width="5" height="5" rx="0.5" />
      </svg>
    ),
  },
  {
    key: "agenda",
    label: "Agenda",
    icon: (
      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
];

function getHeading(date: Date, view: CalendarView): string {
  switch (view) {
    case "day":
      return format(date, "EEEE, MMMM d, yyyy");
    case "week": {
      const start = startOfWeek(date, { weekStartsOn: 0 });
      const end = endOfWeek(date, { weekStartsOn: 0 });
      return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
    }
    case "month":
      return format(date, "MMMM yyyy");
    case "year":
      return format(date, "yyyy");
    case "agenda":
      return format(date, "MMMM yyyy");
  }
}

function getSubheading(date: Date, view: CalendarView): string {
  switch (view) {
    case "day":
      return format(date, "MMM d, yyyy");
    case "week": {
      const start = startOfWeek(date, { weekStartsOn: 0 });
      const end = endOfWeek(date, { weekStartsOn: 0 });
      return `${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")}`;
    }
    case "month": {
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      return `${format(monthStart, "MMM d, yyyy")} - ${format(monthEnd, "MMM d, yyyy")}`;
    }
    case "year":
      return `Jan 1, ${date.getFullYear()} - Dec 31, ${date.getFullYear()}`;
    case "agenda": {
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      return `${format(monthStart, "MMM d, yyyy")} - ${format(monthEnd, "MMM d, yyyy")}`;
    }
  }
}

export function CalendarHeader({
  currentDate,
  view,
  events,
  onViewChange,
  onPrev,
  onNext,
  onToday,
}: CalendarHeaderProps) {
  const today = new Date();
  const { theme, toggle } = useTheme();

  return (
    <div className="flex flex-col gap-4 border-b border-cal-border p-4 lg:flex-row lg:items-center lg:justify-between">
      {/* Left side */}
      <div className="flex items-center gap-4">
        {/* Today button */}
        <button
          onClick={onToday}
          className="flex size-14 flex-col items-center justify-center rounded-xl border border-cal-border-strong bg-cal-surface transition-colors hover:bg-cal-surface-hover"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-cal-text-muted">
            {format(today, "MMM")}
          </span>
          <span className="text-lg font-bold leading-none text-cal-text">
            {format(today, "d")}
          </span>
        </button>

        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-cal-text">
              {getHeading(currentDate, view)}
            </h2>
            <span className="rounded-full border border-cal-border-strong px-2.5 py-0.5 text-xs text-cal-text-muted">
              {events.length} events
            </span>
          </div>
          <span className="text-sm text-cal-text-dimmed">
            {getSubheading(currentDate, view)}
          </span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Navigation */}
        <div className="flex items-center">
          <button
            onClick={onPrev}
            className="rounded-l-lg border border-cal-border-strong bg-cal-surface p-2 transition-colors hover:bg-cal-surface-hover"
          >
            <svg
              className="size-4 text-cal-text-secondary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={onNext}
            className="-ml-px rounded-r-lg border border-cal-border-strong bg-cal-surface p-2 transition-colors hover:bg-cal-surface-hover"
          >
            <svg
              className="size-4 text-cal-text-secondary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* View switcher */}
        <div className="flex items-center">
          {views.map((v, i, arr) => (
            <button
              key={v.key}
              onClick={() => onViewChange(v.key)}
              className={`${i > 0 ? "-ml-px" : ""} border p-2 transition-colors ${
                i === 0 ? "rounded-l-lg" : ""
              } ${i === arr.length - 1 ? "rounded-r-lg" : ""} ${
                view === v.key
                  ? "border-cal-border-accent bg-cal-accent text-cal-accent-text"
                  : "border-cal-border-strong bg-cal-surface text-cal-text-muted hover:bg-cal-surface-hover"
              }`}
              title={v.label}
            >
              {v.icon}
            </button>
          ))}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="rounded-lg border border-cal-border-strong bg-cal-surface p-2 transition-colors hover:bg-cal-surface-hover"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            <svg className="size-4 text-cal-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="size-4 text-cal-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {/* Add event button */}
        <button className="flex items-center gap-2 rounded-lg bg-cal-accent px-4 py-2 text-sm font-medium text-cal-accent-text transition-colors hover:bg-cal-accent-hover">
          <svg
            className="size-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Event
        </button>
      </div>
    </div>
  );
}

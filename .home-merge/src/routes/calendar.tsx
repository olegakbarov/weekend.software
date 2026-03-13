import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  getGoogleCalendarEvents,
  type GetGoogleCalendarEventsInput,
} from "~/lib/google-calendar-server";
import {
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  addYears,
  subYears,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
} from "~/lib/calendar-utils";
import type { CalendarEvent, CalendarView } from "~/lib/calendar-types";
import { sampleEvents } from "~/lib/calendar-data";
import { CalendarHeader } from "~/components/calendar/calendar-header";
import { MonthView } from "~/components/calendar/month-view";
import { DayView } from "~/components/calendar/day-view";
import { WeekView } from "~/components/calendar/week-view";
import { YearView } from "~/components/calendar/year-view";
import { AgendaView } from "~/components/calendar/agenda-view";

interface LiveEventsRange {
  start: Date;
  end: Date;
}

const LIVE_CALENDAR_ID = "primary";
const AUTH_SETUP_COMMAND = "pnpm exec gws auth setup";
const AUTH_LOGIN_COMMAND = "pnpm exec gws auth login";

export const Route = createFileRoute("/calendar")({
  component: CalendarRouteComponent,
});

function CalendarRouteComponent() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [events, setEvents] = useState<CalendarEvent[]>(sampleEvents);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConnectHelp, setShowConnectHelp] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const lastRequestIdRef = useRef(0);

  const fetchRange = useMemo(
    () => getFetchRange(currentDate, view),
    [currentDate, view]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncOnlineStatus = () => {
      setIsOffline(!window.navigator.onLine);
    };

    syncOnlineStatus();
    window.addEventListener("online", syncOnlineStatus);
    window.addEventListener("offline", syncOnlineStatus);

    return () => {
      window.removeEventListener("online", syncOnlineStatus);
      window.removeEventListener("offline", syncOnlineStatus);
    };
  }, []);

  useEffect(() => {
    const requestId = ++lastRequestIdRef.current;

    if (isOffline) {
      setEvents(sampleEvents);
      setErrorMessage(null);
      setIsLoading(false);
      return;
    }

    const requestData: GetGoogleCalendarEventsInput = {
      startIso: fetchRange.start.toISOString(),
      endIso: fetchRange.end.toISOString(),
      calendarId: LIVE_CALENDAR_ID,
    };

    setIsLoading(true);
    setErrorMessage(null);

    getGoogleCalendarEvents({ data: requestData })
      .then((response) => {
        if (lastRequestIdRef.current !== requestId) {
          return;
        }

        if (response.error) {
          setEvents(sampleEvents);
          setErrorMessage(response.error);
          if (isGoogleAuthError(response.error)) {
            setShowConnectHelp(true);
          }
          return;
        }

        setEvents(response.events);
        setShowConnectHelp(false);
      })
      .catch((error) => {
        if (lastRequestIdRef.current !== requestId) {
          return;
        }

        console.error(error);
        setEvents(sampleEvents);
        setErrorMessage("Live sync unavailable. Showing sample events.");
      })
      .finally(() => {
        if (lastRequestIdRef.current === requestId) {
          setIsLoading(false);
        }
      });
  }, [fetchRange, isOffline]);

  function handlePrev() {
    setCurrentDate((date) => {
      switch (view) {
        case "day":
          return subDays(date, 1);
        case "week":
          return subWeeks(date, 1);
        case "month":
        case "agenda":
          return subMonths(date, 1);
        case "year":
          return subYears(date, 1);
      }
    });
  }

  function handleNext() {
    setCurrentDate((date) => {
      switch (view) {
        case "day":
          return addDays(date, 1);
        case "week":
          return addWeeks(date, 1);
        case "month":
        case "agenda":
          return addMonths(date, 1);
        case "year":
          return addYears(date, 1);
      }
    });
  }

  function handleToday() {
    setCurrentDate(new Date());
  }

  function handleMonthClick(date: Date) {
    setCurrentDate(date);
    setView("month");
  }

  const statusMessage = isOffline ? "Offline. Showing sample events." : errorMessage;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <CalendarHeader
        currentDate={currentDate}
        view={view}
        events={events}
        onViewChange={setView}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
      />

      <div className="flex items-center gap-2 border-b border-cal-border px-4 py-1.5 text-xs">
        {isLoading && (
          <span className="rounded-full border border-cal-border-strong px-2 py-0.5 text-cal-text-dimmed">
            Loading live events...
          </span>
        )}
        {statusMessage && (
          <span className="rounded-full border border-cal-border-strong px-2 py-0.5 text-cal-text-muted">
            {statusMessage}
          </span>
        )}
        <button
          onClick={() => setShowConnectHelp((visible) => !visible)}
          className="rounded-full border border-cal-border-strong px-2 py-0.5 text-cal-text-secondary transition-colors hover:bg-cal-surface-hover"
        >
          {showConnectHelp ? "Hide Google setup" : "Google setup"}
        </button>
      </div>

      {showConnectHelp && (
        <div className="border-b border-cal-border bg-cal-surface px-4 py-2 text-xs text-cal-text-muted">
          <p className="mb-2 text-cal-text">
            Connect is terminal-based for now. Run these commands in this project directory:
          </p>
          {isOffline && (
            <p className="mb-2 text-cal-text-muted">
              You are offline. Complete setup first, then reconnect before retrying live sync.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded border border-cal-border-strong bg-cal-bg px-2 py-1">
              {AUTH_SETUP_COMMAND}
            </code>
            <code className="rounded border border-cal-border-strong bg-cal-bg px-2 py-1">
              {AUTH_LOGIN_COMMAND}
            </code>
            <button
              onClick={() => {
                window.location.reload();
              }}
              className="rounded border border-cal-border-strong px-2 py-1 text-cal-text-secondary transition-colors hover:bg-cal-surface-hover"
            >
              Retry live sync
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {view === "month" && <MonthView currentDate={currentDate} events={events} />}
        {view === "day" && <DayView currentDate={currentDate} events={events} />}
        {view === "week" && <WeekView currentDate={currentDate} events={events} />}
        {view === "year" && (
          <YearView
            currentDate={currentDate}
            events={events}
            onMonthClick={handleMonthClick}
          />
        )}
        {view === "agenda" && <AgendaView currentDate={currentDate} events={events} />}
      </div>
    </div>
  );
}

function isGoogleAuthError(message: string | null): boolean {
  return typeof message === "string" && /Google Calendar is not connected/i.test(message);
}

function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getFetchRange(currentDate: Date, view: CalendarView): LiveEventsRange {
  switch (view) {
    case "day": {
      const anchor = startOfDay(currentDate);
      return {
        start: subDays(anchor, 14),
        end: endOfDay(addDays(anchor, 14)),
      };
    }
    case "week": {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return {
        start: subWeeks(weekStart, 4),
        end: endOfDay(addWeeks(weekEnd, 4)),
      };
    }
    case "year": {
      const yearStart = new Date(currentDate.getFullYear(), 0, 1);
      const yearEnd = new Date(currentDate.getFullYear(), 11, 31);
      return {
        start: subMonths(startOfMonth(yearStart), 1),
        end: endOfDay(addMonths(endOfMonth(yearEnd), 1)),
      };
    }
    case "month":
    case "agenda": {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      return {
        start: subMonths(monthStart, 1),
        end: endOfDay(addMonths(monthEnd, 1)),
      };
    }
  }
}

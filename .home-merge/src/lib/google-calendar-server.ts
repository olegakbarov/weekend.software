import { createServerFn } from "@tanstack/react-start";
import type { CalendarEvent, EventColor } from "~/lib/calendar-types";

export interface GetGoogleCalendarEventsInput {
  startIso: string;
  endIso: string;
  calendarId?: string;
}

export interface GoogleCalendarEventsResult {
  events: CalendarEvent[];
  source: "gws" | "fallback";
  fetchedAt: string;
  calendarId: string;
  error?: string;
}

interface GoogleCalendarDateTime {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}

interface GoogleCalendarEvent {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  eventType?: string;
  colorId?: string;
  start?: GoogleCalendarDateTime;
  end?: GoogleCalendarDateTime;
}

interface GoogleCalendarEventsListResponse {
  items?: GoogleCalendarEvent[];
}

interface GwsCalendarErrorResponse {
  error?: {
    code?: number;
    message?: string;
    reason?: string;
  };
}

const EVENT_COLORS: EventColor[] = [
  "blue",
  "green",
  "red",
  "yellow",
  "purple",
  "orange",
  "gray",
];

const EVENT_TYPE_COLORS: Record<string, EventColor> = {
  birthday: "orange",
  default: "blue",
  focusTime: "purple",
  fromGmail: "blue",
  outOfOffice: "red",
  workingLocation: "gray",
};

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

export const getGoogleCalendarEvents = createServerFn({ method: "GET" })
  .inputValidator(
    (input: Partial<GetGoogleCalendarEventsInput> | undefined): GetGoogleCalendarEventsInput => {
      const now = new Date();
      const defaultEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const calendarId =
        typeof input?.calendarId === "string" && input.calendarId.trim().length > 0
          ? input.calendarId.trim()
          : "primary";

      return {
        startIso: typeof input?.startIso === "string" ? input.startIso : now.toISOString(),
        endIso: typeof input?.endIso === "string" ? input.endIso : defaultEnd.toISOString(),
        calendarId,
      };
    }
  )
  .handler(async ({ data }): Promise<GoogleCalendarEventsResult> => {
    const fetchedAt = new Date().toISOString();
    const calendarId = data.calendarId || "primary";
    const start = new Date(data.startIso);
    const end = new Date(data.endIso);

    if (!isValidDate(start) || !isValidDate(end) || start >= end) {
      return {
        events: [],
        source: "fallback",
        fetchedAt,
        calendarId,
        error: "Invalid live sync date range.",
      };
    }

    const params = {
      calendarId,
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      showDeleted: false,
      maxResults: 2500,
    };

    try {
      const response = await runGwsCalendarEventsList(params);
      const events = normalizeGoogleEvents(response.items || []);

      return {
        events,
        source: "gws",
        fetchedAt,
        calendarId,
      };
    } catch (error) {
      return {
        events: [],
        source: "fallback",
        fetchedAt,
        calendarId,
        error: normalizeGwsError(error),
      };
    }
  });

async function runGwsCalendarEventsList(
  params: Record<string, unknown>
): Promise<GoogleCalendarEventsListResponse> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const args = [
    "exec",
    "gws",
    "calendar",
    "events",
    "list",
    "--params",
    JSON.stringify(params),
    "--format",
    "json",
  ];

  try {
    const { stdout } = await execFileAsync("pnpm", args, {
      cwd: process.cwd(),
      env: { ...process.env, NO_COLOR: "1" },
      maxBuffer: 10 * 1024 * 1024,
    });
    return parseGwsJson(stdout);
  } catch (error) {
    const maybeStdout = getSubprocessOutput(error, "stdout");
    const maybeStderr = getSubprocessOutput(error, "stderr");
    const combinedOutput = [maybeStdout, maybeStderr].filter(Boolean).join("\n");

    if (combinedOutput) {
      return parseGwsJson(combinedOutput);
    }

    throw error;
  }
}

function parseGwsJson(rawOutput: string): GoogleCalendarEventsListResponse {
  const jsonText = extractJson(rawOutput);

  if (!jsonText) {
    throw new Error("gws returned no JSON output.");
  }

  const parsed = JSON.parse(jsonText) as
    | GoogleCalendarEventsListResponse
    | GwsCalendarErrorResponse;

  if (parsed && typeof parsed === "object" && "error" in parsed && parsed.error) {
    const apiError = parsed as GwsCalendarErrorResponse;
    throw new Error(apiError.error?.message || "gws request failed.");
  }

  return parsed as GoogleCalendarEventsListResponse;
}

function extractJson(rawOutput: string): string | null {
  const trimmed = rawOutput.trim();

  if (!trimmed) return null;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return trimmed;
  }

  const firstJsonBrace = trimmed.indexOf("{");
  const firstJsonBracket = trimmed.indexOf("[");
  const jsonStartCandidates = [firstJsonBrace, firstJsonBracket].filter(
    (value) => value >= 0
  );

  if (jsonStartCandidates.length === 0) {
    return null;
  }

  const jsonStart = Math.min(...jsonStartCandidates);
  return trimmed.slice(jsonStart).trim();
}

function normalizeGoogleEvents(events: GoogleCalendarEvent[]): CalendarEvent[] {
  return events
    .filter((event) => event.status !== "cancelled")
    .map(normalizeGoogleEvent)
    .filter((event): event is CalendarEvent => event !== null)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

function normalizeGoogleEvent(event: GoogleCalendarEvent): CalendarEvent | null {
  const dateRange = normalizeDateRange(event.start, event.end);

  if (!dateRange) {
    return null;
  }

  const id = event.id || buildFallbackId(event, dateRange.startDate);
  const title =
    typeof event.summary === "string" && event.summary.trim().length > 0
      ? event.summary.trim()
      : "(No title)";
  const descriptionParts = [event.description, event.location]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  const description = descriptionParts.join(" \u2022 ");

  return {
    id,
    title,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    color: pickEventColor(event, id),
    description,
  };
}

function normalizeDateRange(
  start: GoogleCalendarDateTime | undefined,
  end: GoogleCalendarDateTime | undefined
): { startDate: string; endDate: string } | null {
  if (!start) return null;

  if (start.dateTime) {
    const parsedStart = new Date(start.dateTime);
    if (!isValidDate(parsedStart)) return null;

    let endDate = end?.dateTime;
    if (!endDate || !isValidDate(new Date(endDate))) {
      endDate = new Date(parsedStart.getTime() + THIRTY_MINUTES_MS).toISOString();
    }

    return { startDate: start.dateTime, endDate };
  }

  if (start.date) {
    const startDay = start.date;
    const endExclusiveDay = end?.date || shiftUtcDay(startDay, 1);
    let inclusiveEndDay = shiftUtcDay(endExclusiveDay, -1);

    if (inclusiveEndDay < startDay) {
      inclusiveEndDay = startDay;
    }

    return {
      startDate: `${startDay}T00:00:00`,
      endDate: `${inclusiveEndDay}T23:59:59`,
    };
  }

  return null;
}

function pickEventColor(event: GoogleCalendarEvent, id: string): EventColor {
  if (event.eventType && EVENT_TYPE_COLORS[event.eventType]) {
    return EVENT_TYPE_COLORS[event.eventType];
  }

  if (typeof event.colorId === "string") {
    const parsedColorId = Number.parseInt(event.colorId, 10);
    if (!Number.isNaN(parsedColorId)) {
      return EVENT_COLORS[Math.abs(parsedColorId) % EVENT_COLORS.length];
    }
  }

  const hash = hashString(id);
  return EVENT_COLORS[hash % EVENT_COLORS.length];
}

function buildFallbackId(event: GoogleCalendarEvent, startDate: string): string {
  const base = [event.summary || "untitled", startDate, event.location || ""].join("|");
  return `generated-${hashString(base).toString(16)}`;
}

function hashString(value: string): number {
  let hash = 0;

  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
}

function shiftUtcDay(yyyyMmDd: string, deltaDays: number): string {
  const source = new Date(`${yyyyMmDd}T00:00:00.000Z`);
  if (!isValidDate(source)) return yyyyMmDd;
  source.setUTCDate(source.getUTCDate() + deltaDays);
  return source.toISOString().slice(0, 10);
}

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

function getSubprocessOutput(error: unknown, key: "stdout" | "stderr"): string {
  if (typeof error !== "object" || error === null) return "";
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function normalizeGwsError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/(No credentials found|No OAuth client configured|auth failed)/i.test(message)) {
    return "Google Calendar is not connected. Run `pnpm exec gws auth setup` once, then `pnpm exec gws auth login`.";
  }

  if (/(gws.*not found|command not found|ENOENT)/i.test(message)) {
    return "gws CLI is unavailable on the server runtime.";
  }

  return "Live sync unavailable. Showing sample events.";
}

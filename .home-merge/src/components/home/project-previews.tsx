import { primaryLinks } from "~/features/gmail/nav-data";
import { getDemoDashboard } from "~/features/finance/server/mock-data";
import {
  SHARED_FILES,
  SHARED_FOLDERS,
  SHARED_FOLDER_ID,
} from "~/features/research/store";
import { sampleEvents } from "~/lib/calendar-data";

const directionalBorderClass =
  "border-b border-r border-b-white/10 border-r-white/10 border-l border-t border-l-white/30 border-t-white/30";

const wholeCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const signedCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
  signDisplay: "always",
});

const shortDay = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const shortTime = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

const financePreview = getDemoDashboard(false);
const financeNetCash =
  financePreview.summary.liquidBalance - financePreview.summary.creditBalance;
const researchFolderCount = SHARED_FOLDERS.filter(
  (folder) => folder.parentId === SHARED_FOLDER_ID
).length;
const researchDocuments = SHARED_FILES.filter(
  (file) => file.folderId === "documents"
).length;
const researchImages = SHARED_FILES.filter(
  (file) => file.folderId === "images"
).length;
const researchFonts = SHARED_FILES.filter((file) => file.folderId === "fonts").length;

const gmailInboxCount = primaryLinks[0]?.label || "0";
const gmailDraftCount = primaryLinks[1]?.label || "0";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isSameDay(iso: string, date: Date) {
  const current = new Date(iso);
  return (
    current.getFullYear() === date.getFullYear() &&
    current.getMonth() === date.getMonth() &&
    current.getDate() === date.getDate()
  );
}

function formatEventTime(startIso: string, endIso: string) {
  return `${shortTime.format(new Date(startIso))} - ${shortTime.format(
    new Date(endIso)
  )}`;
}

const sortedEvents = [...sampleEvents].sort(
  (left, right) =>
    new Date(left.startDate).getTime() - new Date(right.startDate).getTime()
);

const today = new Date();
const tomorrow = addDays(today, 1);
const upcomingEvents = sortedEvents.filter(
  (event) => new Date(event.endDate).getTime() >= startOfDay(today).getTime()
);
const todayExactEvents = upcomingEvents.filter((event) =>
  isSameDay(event.startDate, today)
);
const tomorrowExactEvents = upcomingEvents.filter((event) =>
  isSameDay(event.startDate, tomorrow)
);

const fallbackEvents = upcomingEvents.filter(
  (event) =>
    !todayExactEvents.some((exact) => exact.id === event.id) &&
    !tomorrowExactEvents.some((exact) => exact.id === event.id)
);

const todayEvents = todayExactEvents.length
  ? todayExactEvents.slice(0, 2)
  : fallbackEvents.slice(0, 1);

const tomorrowFallback = fallbackEvents.filter(
  (event) => !todayEvents.some((todayEvent) => todayEvent.id === event.id)
);

const tomorrowEvents = tomorrowExactEvents.length
  ? tomorrowExactEvents.slice(0, 2)
  : tomorrowFallback.slice(0, 1);

const calendarDays = [
  {
    label: "Today",
    dateLabel: shortDay.format(today),
    events: todayEvents,
  },
  {
    label: "Tomorrow",
    dateLabel: shortDay.format(tomorrow),
    events: tomorrowEvents,
  },
];

const gmailInboxPreview = [
  {
    sender: "Priority",
    subject: "Unread threads stay pinned first",
    meta: "Focus",
  },
  {
    sender: "Search",
    subject: "Find mail across sender, subject, and body",
    meta: "Filter",
  },
];

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={`${directionalBorderClass} px-2.5 py-2`}>
      <p className="text-[0.63rem] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-base font-medium tracking-[-0.02em] text-foreground">
        {value}
      </p>
    </div>
  );
}

export function GmailPreview() {
  return (
    <div className={`flex h-full min-h-0 flex-col gap-2 p-3 ${directionalBorderClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.63rem] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Inbox
          </p>
          <p className="mt-1 truncate text-sm font-medium text-foreground">
            {gmailInboxCount} threads in focus
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
          Drafts {gmailDraftCount}
        </span>
      </div>
      <div className={`${directionalBorderClass} px-3 py-2 text-sm text-muted-foreground`}>
        Search inbox
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {gmailInboxPreview.map((row) => (
          <div
            key={row.sender}
            className={`${directionalBorderClass} min-w-0 px-3 py-2`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-medium text-foreground">
                {row.sender}
              </p>
              <span className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
                {row.meta}
              </span>
            </div>
            <p className="mt-1 text-sm text-foreground">{row.subject}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="All mail" value={gmailInboxCount} />
        <MetricCard label="Unread view" value="On" />
      </div>
    </div>
  );
}

export function CalendarPreview() {
  return (
    <div className="grid h-full min-h-0 gap-2 md:grid-cols-2">
      {calendarDays.map((day) => (
        <div
          key={day.label}
          className={`flex min-h-0 flex-col gap-2 p-3 ${directionalBorderClass}`}
        >
          <div>
            <p className="text-[0.63rem] font-medium uppercase tracking-[0.24em] text-muted-foreground">
              {day.label}
            </p>
            <p className="mt-1 truncate text-sm font-medium text-foreground">
              {day.dateLabel}
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            {day.events.length ? (
              day.events.map((event) => (
                <div
                  key={event.id}
                  className={`${directionalBorderClass} min-w-0 px-3 py-2`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-foreground">
                      {event.title}
                    </p>
                    <span className="text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
                      {formatEventTime(event.startDate, event.endDate)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {event.description}
                  </p>
                </div>
              ))
            ) : (
              <div className={`${directionalBorderClass} px-3 py-2 text-sm text-muted-foreground`}>
                Nothing scheduled.
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function FinancePreview() {
  return (
    <div className={`flex h-full min-h-0 flex-col gap-2 p-3 ${directionalBorderClass}`}>
      <div className="min-w-0">
        <p className="text-[0.63rem] font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Key Stats
        </p>
        <p className="mt-1 truncate text-sm font-medium text-foreground">
          Snapshot from the finance dashboard
        </p>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2">
        <MetricCard
          label="Net cash"
          value={wholeCurrency.format(financeNetCash)}
        />
        <MetricCard
          label="Net flow"
          value={signedCurrency.format(financePreview.summary.netFlow)}
        />
        <MetricCard
          label="Available credit"
          value={wholeCurrency.format(financePreview.summary.availableCredit)}
        />
        <MetricCard
          label="Accounts"
          value={String(financePreview.summary.connectedAccounts)}
        />
      </div>
      <div className={`${directionalBorderClass} px-3 py-2 text-sm text-muted-foreground`}>
        {financePreview.summary.connectedInstitutions} institutions connected across
        checking, savings, and credit.
      </div>
    </div>
  );
}

export function ResearchPreview() {
  return (
    <div className={`flex h-full min-h-0 flex-col gap-2 p-3 ${directionalBorderClass}`}>
      <div className="min-w-0">
        <p className="text-[0.63rem] font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Summary
        </p>
        <p className="mt-1 text-sm leading-6 text-foreground">
          Shared Assets is the default workspace for uploads, previews, and folder
          navigation.
        </p>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2">
        <MetricCard label="Assets" value={String(SHARED_FILES.length)} />
        <MetricCard label="Folders" value={String(researchFolderCount)} />
        <MetricCard label="Documents" value={String(researchDocuments)} />
        <MetricCard label="Images" value={String(researchImages)} />
      </div>
      <div className={`${directionalBorderClass} px-3 py-2 text-sm text-muted-foreground`}>
        Fonts: {researchFonts}. Shared folders stay available inside Research exactly
        like the standalone project.
      </div>
    </div>
  );
}

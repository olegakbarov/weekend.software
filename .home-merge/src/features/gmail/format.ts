import { cn } from "~/lib/utils";

const relativeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

function relativeUnitFromMs(deltaMs: number): {
  value: number;
  unit: Intl.RelativeTimeFormatUnit;
} {
  const abs = Math.abs(deltaMs);

  if (abs < 60_000) {
    return { value: Math.round(deltaMs / 1_000), unit: "second" };
  }
  if (abs < 3_600_000) {
    return { value: Math.round(deltaMs / 60_000), unit: "minute" };
  }
  if (abs < 86_400_000) {
    return { value: Math.round(deltaMs / 3_600_000), unit: "hour" };
  }
  if (abs < 2_592_000_000) {
    return { value: Math.round(deltaMs / 86_400_000), unit: "day" };
  }
  if (abs < 31_536_000_000) {
    return { value: Math.round(deltaMs / 2_592_000_000), unit: "month" };
  }

  return { value: Math.round(deltaMs / 31_536_000_000), unit: "year" };
}

export function formatRelativeTime(dateIso: string): string {
  const delta = new Date(dateIso).getTime() - Date.now();
  const { value, unit } = relativeUnitFromMs(delta);
  return relativeFormatter.format(value, unit);
}

export function formatDateTime(dateIso: string): string {
  const d = new Date(dateIso);
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
  return `${date}, ${time}`;
}

export function formatSnoozeTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function getNextWeekend(from = new Date()): Date {
  const date = new Date(from);
  date.setHours(10, 0, 0, 0);
  const day = date.getDay();
  const daysUntilSaturday = (6 - day + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilSaturday);
  return date;
}

export function getSnoozeChoices(now = new Date()): Array<{
  label: string;
  value: Date;
}> {
  const laterToday = new Date(now);
  laterToday.setHours(Math.min(now.getHours() + 4, 23), 0, 0, 0);

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);
  nextWeek.setHours(9, 0, 0, 0);

  return [
    { label: "Later today", value: laterToday },
    { label: "Tomorrow", value: tomorrow },
    { label: "This weekend", value: getNextWeekend(now) },
    { label: "Next week", value: nextWeek },
  ];
}

export function includesSearch(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function labelBadgeVariant(label: string):
  | "default"
  | "secondary"
  | "outline" {
  const normalized = label.toLowerCase();
  if (normalized === "work") return "default";
  if (normalized === "personal") return "outline";
  return "secondary";
}

export function separatorClasses(
  orientation: "horizontal" | "vertical",
  className?: string
): string {
  return cn(
    "shrink-0 bg-border",
    orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
    className
  );
}

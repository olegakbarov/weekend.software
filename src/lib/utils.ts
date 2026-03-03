import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getTaskContentTitle(
  content: string | null | undefined
): string | null {
  if (!content) {
    return null;
  }
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const title = (parsed as { title?: unknown }).title;
    if (typeof title !== "string") {
      return null;
    }
    const normalized = title.trim();
    return normalized ? normalized : null;
  } catch {
    return null;
  }
}

/**
 * Extract display title for a task.
 * Priority: planTitle > content.title > fallbackTitle > "Untitled"
 */
export function getTaskDisplayTitle(
  content: string | null | undefined,
  fallbackTitle: string | null | undefined,
  planTitle?: string | null
): string {
  if (planTitle?.trim()) return planTitle.trim();
  const contentTitle = getTaskContentTitle(content);
  if (contentTitle) return contentTitle;
  return fallbackTitle || "Untitled";
}

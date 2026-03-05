export function toErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const trimmed = message.trim();
  return trimmed.length > 0 ? trimmed : "Unknown error";
}

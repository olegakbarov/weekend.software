import { invoke } from "@tauri-apps/api/core";
import { MOCK_MODE } from "@/lib/tauri-mock";

type UiLogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

type UiLogEntry = {
  level: UiLogLevel;
  message: string;
};

type ConsoleMethod = "log" | "info" | "warn" | "error" | "debug";

const FLUSH_DELAY_MS = 250;
const MAX_QUEUE_LENGTH = 500;
const MAX_BATCH_SIZE = 50;
const MAX_MESSAGE_LENGTH = 4000;
const LOGGER_INIT_FLAG = "__WEEKEND_UI_LOGGER_INIT__";

let queue: UiLogEntry[] = [];
let flushTimerId: number | null = null;
let isFlushing = false;

function stringifyLogValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeLogMessage(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length <= MAX_MESSAGE_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_MESSAGE_LENGTH - 3)}...`;
}

function pushLog(level: UiLogLevel, rawMessage: string): void {
  if (MOCK_MODE) return;

  const message = normalizeLogMessage(rawMessage);
  if (!message) return;

  queue.push({ level, message });
  if (queue.length > MAX_QUEUE_LENGTH) {
    queue = queue.slice(queue.length - MAX_QUEUE_LENGTH);
  }

  scheduleFlush();
}

function formatLogArgs(args: unknown[]): string {
  return args.map((value) => stringifyLogValue(value)).join(" ");
}

async function flushQueue(): Promise<void> {
  if (isFlushing || queue.length === 0 || MOCK_MODE) {
    return;
  }

  isFlushing = true;
  try {
    while (queue.length > 0) {
      const batch = queue.slice(0, MAX_BATCH_SIZE);
      queue = queue.slice(batch.length);

      try {
        await invoke("ui_log_batch", { entries: batch });
      } catch {
        // Backend may not be available during startup/reload. Keep going without throwing.
        break;
      }
    }
  } finally {
    isFlushing = false;
    if (queue.length > 0) {
      scheduleFlush();
    }
  }
}

function scheduleFlush(): void {
  if (flushTimerId !== null) return;
  flushTimerId = window.setTimeout(() => {
    flushTimerId = null;
    void flushQueue();
  }, FLUSH_DELAY_MS);
}

function patchConsoleMethod(method: ConsoleMethod, level: UiLogLevel): void {
  const original = console[method].bind(console);
  const patched = (...args: unknown[]) => {
    original(...args);
    pushLog(level, formatLogArgs(args));
  };
  (console as Console & Record<ConsoleMethod, (...args: unknown[]) => void>)[method] =
    patched;
}

export function initUiFileLogger(): void {
  if (typeof window === "undefined") return;
  if (MOCK_MODE) return;

  const win = window as Window & { [LOGGER_INIT_FLAG]?: boolean };
  if (win[LOGGER_INIT_FLAG]) return;
  win[LOGGER_INIT_FLAG] = true;

  patchConsoleMethod("log", "INFO");
  patchConsoleMethod("info", "INFO");
  patchConsoleMethod("warn", "WARN");
  patchConsoleMethod("error", "ERROR");
  patchConsoleMethod("debug", "DEBUG");

  window.addEventListener("error", (event) => {
    const location = event.filename
      ? `${event.filename}:${event.lineno}:${event.colno}`
      : "unknown";
    pushLog("ERROR", `window.error ${location} ${event.message}`);
    if (event.error) {
      pushLog("ERROR", stringifyLogValue(event.error));
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    pushLog("ERROR", `unhandledrejection ${stringifyLogValue(event.reason)}`);
  });

  window.addEventListener("beforeunload", () => {
    void flushQueue();
  });

  pushLog("INFO", "ui file logger initialized");
}

export const ISPO_DEV_LOG_KEY = "ispo.ui.logs";

interface StorageErrorShape {
  name?: unknown;
  message?: unknown;
  code?: unknown;
}

function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as StorageErrorShape;
  const name = typeof err.name === "string" ? err.name : "";
  const message = typeof err.message === "string" ? err.message : "";
  const code = typeof err.code === "number" ? err.code : undefined;

  // WebKit/Safari: DOMException { name: "QuotaExceededError", message: "The quota has been exceeded." }
  if (name === "QuotaExceededError") return true;

  // Firefox
  if (name === "NS_ERROR_DOM_QUOTA_REACHED") return true;

  // Legacy numeric codes (22 is commonly used for quota errors)
  if (code === 22 || code === 1014) return true;

  return message.toLowerCase().includes("quota");
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function safeLocalStorageGetItem(key: string): string | null {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeLocalStorageSetItem(key: string, value: string): void {
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(key, value);
    return;
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      return;
    }

    // Best-effort recovery: dev UI logs are non-essential and can be large.
    // If storage is full, drop them and retry the write that triggered the error.
    if (key !== ISPO_DEV_LOG_KEY) {
      try {
        storage.removeItem(ISPO_DEV_LOG_KEY);
      } catch {
        // Ignore.
      }
      try {
        storage.setItem(key, value);
      } catch {
        // Ignore.
      }
    }
  }
}

export function safeLocalStorageRemoveItem(key: string): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore.
  }
}

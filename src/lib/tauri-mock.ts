import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow as tauriGetCurrentWindow } from "@tauri-apps/api/window";

type ThemeMode = "light" | "dark";

interface WindowApiLike {
  setTheme: (theme: ThemeMode) => Promise<void>;
  setBackgroundColor: (color: {
    red: number;
    green: number;
    blue: number;
    alpha: number;
  }) => Promise<void>;
}

export function hasTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const internals = (window as { __TAURI_INTERNALS__?: { invoke?: unknown } })
    .__TAURI_INTERNALS__;
  return !!internals && typeof internals.invoke === "function";
}

export const MOCK_MODE = !hasTauriRuntime();

type RuntimeWaitOptions = {
  isCancelled?: () => boolean;
  timeoutMs?: number;
};

const TAURI_RUNTIME_WAIT_TIMEOUT_MS = 1500;
const TAURI_RUNTIME_WAIT_INTERVAL_MS = 16;

const mockWindow: WindowApiLike = {
  setTheme: async () => {},
  setBackgroundColor: async () => {},
};

async function waitForTauriRuntime(
  options: RuntimeWaitOptions = {}
): Promise<boolean> {
  if (hasTauriRuntime()) return true;
  if (typeof window === "undefined") return false;

  const deadline = Date.now() + (options.timeoutMs ?? TAURI_RUNTIME_WAIT_TIMEOUT_MS);

  while (!hasTauriRuntime()) {
    if (options.isCancelled?.()) return false;
    if (Date.now() >= deadline) return false;
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, TAURI_RUNTIME_WAIT_INTERVAL_MS);
    });
  }

  return true;
}

export function getCurrentWindow(): WindowApiLike {
  if (MOCK_MODE) return mockWindow;

  const win = tauriGetCurrentWindow() as unknown as {
    setTheme?: (theme: ThemeMode) => Promise<void>;
    setBackgroundColor?: (color: {
      red: number;
      green: number;
      blue: number;
      alpha: number;
    }) => Promise<void>;
  };

  return {
    setTheme: async (theme) => {
      if (typeof win.setTheme === "function") {
        await win.setTheme(theme);
      }
    },
    setBackgroundColor: async (color) => {
      if (typeof win.setBackgroundColor === "function") {
        await win.setBackgroundColor(color);
      }
    },
  };
}

export async function setTrafficLightsVisible(
  visible: boolean,
  options: RuntimeWaitOptions = {}
): Promise<void> {
  const hasRuntime = await waitForTauriRuntime(options);
  if (!hasRuntime) return;
  await invoke("set_traffic_lights_visible", { visible });
}

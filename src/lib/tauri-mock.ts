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

const mockWindow: WindowApiLike = {
  setTheme: async () => {},
  setBackgroundColor: async () => {},
};

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

export async function setTrafficLightsVisible(visible: boolean): Promise<void> {
  if (MOCK_MODE) return;
  await invoke("set_traffic_lights_visible", { visible });
}

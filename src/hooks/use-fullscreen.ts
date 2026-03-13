import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { hasTauriRuntime } from "@/lib/tauri-mock";

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebarCollapsed = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!hasTauriRuntime()) return;

    let disposed = false;
    let unlistenResized: (() => void) | null = null;
    const currentWindow = getCurrentWindow();

    const syncFullscreenState = async () => {
      try {
        const fullscreen = await currentWindow.isFullscreen();
        if (disposed) return;
        setIsFullscreen(fullscreen);
      } catch {
        // Ignore if fullscreen state cannot be read in non-Tauri contexts.
      }
    };

    void syncFullscreenState();
    void currentWindow
      .onResized(() => {
        void syncFullscreenState();
      })
      .then((unlisten) => {
        if (disposed) {
          void unlisten();
          return;
        }
        unlistenResized = unlisten;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      if (unlistenResized) {
        void unlistenResized();
      }
    };
  }, []);

  useEffect(() => {
    if (!isFullscreen) {
      setIsSidebarVisible(false);
      return;
    }
    setIsSidebarVisible(false);
  }, [isFullscreen]);

  return { isFullscreen, isSidebarVisible, setIsSidebarVisible, isSidebarCollapsed, toggleSidebarCollapsed };
}

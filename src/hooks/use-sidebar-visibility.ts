import { useCallback, useEffect, useState } from "react";

export function useSidebarVisibility(isFullscreen: boolean) {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebarCollapsed = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  // Reset hover-triggered visibility when entering/leaving fullscreen
  useEffect(() => {
    setIsSidebarVisible(false);
  }, [isFullscreen]);

  return {
    isSidebarVisible,
    setIsSidebarVisible,
    isSidebarCollapsed,
    toggleSidebarCollapsed,
  };
}

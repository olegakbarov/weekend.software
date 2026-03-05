import { useEffect, useState } from "react";
import {
  safeLocalStorageGetItem,
  safeLocalStorageSetItem,
} from "@/lib/utils/safe-local-storage";

const VIM_MODE_STORAGE_KEY = "weekend.editor.vim-mode-enabled";

function readPersistedVimMode(): boolean {
  const persisted = safeLocalStorageGetItem(VIM_MODE_STORAGE_KEY);
  if (persisted === "0") return false;
  return true;
}

export function useVimMode(): [boolean, (enabled: boolean) => void] {
  const [isEnabled, setIsEnabled] = useState(() => readPersistedVimMode());

  useEffect(() => {
    safeLocalStorageSetItem(VIM_MODE_STORAGE_KEY, isEnabled ? "1" : "0");
  }, [isEnabled]);

  return [isEnabled, setIsEnabled];
}

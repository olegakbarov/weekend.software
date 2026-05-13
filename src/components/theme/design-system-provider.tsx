import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ShapeProvider } from "@weekend/design/registry";
import type { DesignSystemConfigSnapshot, ShapeVariant } from "@/lib/controller";
import { hasTauriRuntime } from "@/lib/tauri-mock";
import {
  applyShellDesignSystem,
  DEFAULT_DESIGN_SYSTEM_CONFIG,
  normalizeConfig,
} from "./design-system-dom";
import { useTheme } from "./use-theme";

type DesignSystemContextValue = {
  config: DesignSystemConfigSnapshot;
  isLoading: boolean;
  error: string | null;
  setConfig: (config: DesignSystemConfigSnapshot) => Promise<void>;
  setShape: (shape: ShapeVariant) => void;
};

const DesignSystemContext = createContext<DesignSystemContextValue | null>(null);

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

export function DesignSystemProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const { activeTheme } = useTheme();
  const [config, setConfigState] = useState<DesignSystemConfigSnapshot>(
    DEFAULT_DESIGN_SYSTEM_CONFIG
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!hasTauriRuntime()) {
        setIsLoading(false);
        return;
      }
      try {
        const persisted = await invoke<DesignSystemConfigSnapshot>(
          "get_design_system_config"
        );
        if (cancelled) return;
        setConfigState(normalizeConfig(persisted));
        setError(null);
      } catch (err) {
        if (!cancelled) setError(toErrorMessage(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasTauriRuntime()) return;
    let unlisten: UnlistenFn | undefined;
    let cancelled = false;
    void (async () => {
      try {
        const off = await listen<DesignSystemConfigSnapshot>(
          "design-system-changed",
          (event) => {
            setConfigState(normalizeConfig(event.payload));
            setError(null);
          }
        );
        if (cancelled) {
          off();
        } else {
          unlisten = off;
        }
      } catch {
        // Browser dev mode has no Tauri event bus.
      }
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    applyShellDesignSystem(config, activeTheme);
  }, [activeTheme, config]);

  const setConfig = useCallback(async (next: DesignSystemConfigSnapshot) => {
    const normalized = normalizeConfig(next);
    setConfigState(normalized);
    setError(null);
    if (!hasTauriRuntime()) return;
    try {
      const persisted = await invoke<DesignSystemConfigSnapshot>(
        "set_design_system_config",
        { config: normalized }
      );
      setConfigState(normalizeConfig(persisted));
    } catch (err) {
      setError(toErrorMessage(err));
      throw err;
    }
  }, []);

  const setShape = useCallback(
    (shape: ShapeVariant) => {
      void setConfig({ ...config, shape }).catch(() => undefined);
    },
    [config, setConfig]
  );

  const value = useMemo(
    () => ({
      config,
      isLoading,
      error,
      setConfig,
      setShape,
    }),
    [config, error, isLoading, setConfig, setShape]
  );

  return (
    <DesignSystemContext.Provider value={value}>
      <ShapeProvider shape={config.shape} onShapeChange={setShape}>
        {children}
      </ShapeProvider>
    </DesignSystemContext.Provider>
  );
}

export function useDesignSystem(): DesignSystemContextValue {
  const context = useContext(DesignSystemContext);
  if (!context) {
    throw new Error("useDesignSystem must be used within DesignSystemProvider");
  }
  return context;
}

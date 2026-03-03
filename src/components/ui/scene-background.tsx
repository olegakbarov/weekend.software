/**
 * Scene Background - UnicornScene wrapper
 *
 * Disabled in mock mode to avoid browser-incompatible code.
 */
import { type ReactNode, useEffect, useState } from "react";
import { MOCK_MODE } from "@/lib/tauri-mock";

interface SceneBackgroundProps {
  jsonFilePath: string;
  className?: string;
}

// Placeholder for fallback/mock mode
function ScenePlaceholder({
  className = "",
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`bg-gradient-to-b from-zinc-900 to-black ${className}`}>
      {children}
    </div>
  );
}

export function SceneBackground({
  jsonFilePath,
  className = "",
}: SceneBackgroundProps) {
  // biome-ignore lint/suspicious/noExplicitAny: third-party component type
  const [Scene, setScene] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    if (MOCK_MODE) return;

    let mounted = true;
    import("unicornstudio-react")
      .then((mod) => {
        if (mounted) setScene(() => mod.default);
      })
      .catch((err) => {
        console.warn("Failed to load UnicornScene:", err);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (MOCK_MODE || !Scene) {
    return <ScenePlaceholder className={`h-full w-full ${className}`} />;
  }

  return (
    <Scene
      dpi={1.5}
      height="100%"
      jsonFilePath={jsonFilePath}
      lazyLoad={false}
      scale={1}
      width="100%"
    />
  );
}

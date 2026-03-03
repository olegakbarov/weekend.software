import { useEffect, useRef } from "react";
import { useTheme } from "@/components/theme/use-theme";
import { terminalRegistry } from "@/lib/terminal-registry";

export function TerminalView({
  terminalId,
  project,
}: {
  terminalId: string;
  project: string;
}) {
  const { resolvedMode } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;

    void terminalRegistry.acquire(terminalId, project).then(() => {
      if (disposed) return;
      terminalRegistry.attach(terminalId, container);
    });

    return () => {
      disposed = true;
      terminalRegistry.detach(terminalId);
    };
  }, [terminalId, project]);

  useEffect(() => {
    terminalRegistry.setTheme(resolvedMode === "dark" ? "dark" : "light");
  }, [resolvedMode]);

  return (
    <div className="h-full min-h-0 w-full bg-transparent px-3 py-2">
      <div className="h-full w-full cursor-text" ref={containerRef} />
    </div>
  );
}

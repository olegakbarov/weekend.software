import { Plus } from "lucide-react";
import type { TerminalSessionDescriptor } from "@/lib/controller";
import { TerminalItem } from "@/components/sidebar/terminal-item";
import { TERMINAL_INDENT_PX } from "@/components/sidebar/sidebar-constants";

export function TerminalList({
  project,
  terminalSessions,
  activeTerminalId,
  onSelectTerminal,
  onCreateTerminal,
  onRenameTerminal,
  onRemoveTerminal,
}: {
  project: string;
  terminalSessions: TerminalSessionDescriptor[];
  activeTerminalId: string | null;
  onSelectTerminal: (project: string, terminalId: string) => void;
  onCreateTerminal: (project: string) => void;
  onRenameTerminal: (terminalId: string, newLabel: string) => void;
  onRemoveTerminal: (terminalId: string) => void;
}) {
  return (
    <div
      className="mt-px space-y-px pb-0.5"
      style={{ marginLeft: `${TERMINAL_INDENT_PX}px` }}
    >
      {terminalSessions.map((session) => (
        <TerminalItem
          key={session.terminalId}
          session={session}
          isActive={activeTerminalId === session.terminalId}
          project={project}
          onSelectTerminal={onSelectTerminal}
          onRenameTerminal={onRenameTerminal}
          onRemoveTerminal={onRemoveTerminal}
        />
      ))}
      <button
        className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left font-vcr text-[12px] text-muted-foreground/40 transition-colors hover:text-muted-foreground"
        onClick={(e) => {
          e.stopPropagation();
          onCreateTerminal(project);
        }}
        type="button"
      >
        <Plus className="size-3 shrink-0" />
        NEW TERMINAL
      </button>
    </div>
  );
}

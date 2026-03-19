import { Terminal as TerminalIcon, X } from "lucide-react";
import { useRef, useState } from "react";
import { type TerminalSessionDescriptor, terminalDisplayLabel } from "@/lib/controller";

export function TerminalItem({
  session,
  isActive,
  project,
  onSelectTerminal,
  onRenameTerminal,
  onRemoveTerminal,
}: {
  session: TerminalSessionDescriptor;
  isActive: boolean;
  project: string;
  onSelectTerminal: (project: string, terminalId: string) => void;
  onRenameTerminal: (terminalId: string, newLabel: string) => void;
  onRemoveTerminal: (terminalId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const startRename = () => {
    setIsEditing(true);
    setEditValue(terminalDisplayLabel(session));
    requestAnimationFrame(() => editInputRef.current?.select());
  };

  const commitRename = () => {
    if (editValue.trim()) {
      onRenameTerminal(session.terminalId, editValue.trim());
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="group/term flex items-center">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1">
          <TerminalIcon className="size-3 shrink-0 text-muted-foreground" />
          <input
            ref={editInputRef}
            className="min-w-0 flex-1 bg-transparent font-code text-[13px] text-foreground outline-none"
            onBlur={commitRename}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setIsEditing(false);
            }}
            value={editValue}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="group/term flex items-center">
      <button
        className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left font-code text-[13px] transition-colors ${
          isActive
            ? "text-foreground"
            : session.status === "exited"
              ? "text-muted-foreground/35 hover:bg-secondary/40 hover:text-muted-foreground"
              : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onSelectTerminal(project, session.terminalId);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          startRename();
        }}
        type="button"
      >
        <TerminalIcon
          className={`size-3 shrink-0 ${
            isActive
              ? "animate-pulse text-foreground"
              : session.status === "exited"
                ? "opacity-30"
                : "opacity-50"
          }`}
        />
        <span className="truncate">{terminalDisplayLabel(session)}</span>
      </button>
      <button
        className="relative shrink-0 rounded p-0.5 text-muted-foreground/0 transition-colors before:absolute before:-inset-3 before:content-[''] hover:text-destructive group-hover/term:text-muted-foreground/25"
        onClick={(e) => {
          e.stopPropagation();
          onRemoveTerminal(session.terminalId);
        }}
        title="Close terminal"
        type="button"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

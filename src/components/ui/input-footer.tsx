/**
 * InputFooter - Composable sub-components for footer input areas.
 *
 * Shared across PlanModeFooter, DocsResearchInput, and CreateTaskPanel
 * to eliminate duplicate agent-dropdown, attach-button, and floating-positioner markup.
 */

import { ChevronDown, Paperclip } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FeatureInput } from "@/components/ui/feature-input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AgentType } from "@/lib/types/session";
import { AGENT_LABELS } from "@/lib/types/session";
import { cn } from "@/lib/utils";

/* ── AgentDropdown ─────────────────────────────── */

interface AgentDropdownProps {
  value: AgentType | undefined;
  onChange: (agent: AgentType) => void;
  availableAgents: AgentType[];
  disabled?: boolean;
  triggerClassName?: string;
}

function AgentDropdown({
  value,
  onChange,
  availableAgents,
  disabled,
  triggerClassName,
}: AgentDropdownProps) {
  if (availableAgents.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded bg-transparent px-2 text-[12px] text-muted-foreground",
          triggerClassName ?? "h-7"
        )}
      >
        NO AGENTS
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FeatureInput.SelectTrigger
          className={triggerClassName ?? "h-7"}
          disabled={disabled}
          type="button"
        >
          <span className="truncate">
            {value ? AGENT_LABELS[value].toUpperCase() : "SELECT AGENT"}
          </span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </FeatureInput.SelectTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[max-content] max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuRadioGroup
          onValueChange={(v) => onChange(v as AgentType)}
          value={value ?? ""}
        >
          {availableAgents.map((agent) => (
            <DropdownMenuRadioItem
              className="font-vcr"
              key={agent}
              value={agent}
            >
              {AGENT_LABELS[agent].toUpperCase()}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── AttachButton ──────────────────────────────── */

interface AttachButtonProps {
  count?: number;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

function AttachButton({
  count,
  onClick,
  disabled,
  className,
}: AttachButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={cn(
            "flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground disabled:opacity-50",
            className
          )}
          disabled={disabled}
          onClick={onClick}
          type="button"
        >
          <Paperclip className="size-3.5" />
          {count != null && count > 0 && (
            <span className="ml-1 font-vcr text-[12px]">{count}</span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <span className="font-vcr text-[12px]">ATTACH IMAGES</span>
      </TooltipContent>
    </Tooltip>
  );
}

/* ── FloatingPositioner ────────────────────────── */

interface FloatingPositionerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

function FloatingPositioner({
  children,
  className,
  ...props
}: FloatingPositionerProps) {
  return (
    <div
      className={cn(
        "absolute bottom-4 left-1/2 w-[700px] max-w-[calc(100%-2rem)] -translate-x-1/2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ── Namespace export ──────────────────────────── */

export const InputFooter = {
  AgentDropdown,
  AttachButton,
  FloatingPositioner,
};

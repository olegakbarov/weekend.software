import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CreateProjectInput } from "@/lib/controller";

const MAX_TEXTAREA_HEIGHT = 240;

const AGENT_COMMAND_OPTIONS = [
  "claude",
  "claude --dangerously-skip-permissions",
  "codex",
] as const;

const DEFAULT_AGENT_COMMAND = AGENT_COMMAND_OPTIONS[0];

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const GITHUB_URL_RE =
  /(?:https?:\/\/github\.com\/|git@github\.com:)([\w.-]+)\/([\w.-]+?)(?:\.git)?(?=[\s/?#]|$)/i;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function parsePromptInput(raw: string): CreateProjectInput | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const match = trimmed.match(GITHUB_URL_RE);
  if (match) {
    const repoUrl = match[0].replace(/[)\].,;]+$/, "");
    const repoName = slugify(match[2] ?? "") || "project";
    return {
      name: repoName,
      githubRepoUrl: repoUrl,
      initialPrompt: trimmed,
    };
  }

  const firstWords = trimmed.split(/\s+/).slice(0, 5).join(" ");
  const name = slugify(firstWords) || `project-${Date.now().toString(36)}`;
  return {
    name,
    initialPrompt: trimmed,
  };
}

function AgentCommandPicker({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (next: string) => void;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-md px-2 font-code text-xs normal-case transition-colors",
          "text-muted-foreground hover:text-foreground",
          "disabled:opacity-50",
          open && "text-foreground"
        )}
      >
        <span className="truncate">{value || "agent command"}</span>
        <ChevronDown className="size-3 shrink-0 text-muted-foreground/60" />
      </button>

      {open ? (
        <div
          className={cn(
            "absolute left-0 top-full z-20 mt-2 w-80 overflow-hidden rounded-md border border-border bg-card shadow-lg"
          )}
        >
          <input
            autoFocus
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                setOpen(false);
              }
            }}
            placeholder="Custom command…"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className="w-full bg-transparent px-3 py-2 font-code text-xs outline-none placeholder:text-muted-foreground/40"
          />
          <div className="border-t border-border/60" />
          <ul className="py-1">
            {AGENT_COMMAND_OPTIONS.map((option) => {
              const selected = option === value;
              return (
                <li key={option}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left font-code text-xs normal-case transition-colors",
                      "hover:bg-secondary/60",
                      selected && "bg-secondary/40 text-foreground"
                    )}
                  >
                    <Check
                      className={cn(
                        "size-3 shrink-0",
                        selected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{option}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function HomePage({
  isCreatingProject,
  onCreateProject,
}: {
  isCreatingProject: boolean;
  onCreateProject: (input: CreateProjectInput) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [agentCommand, setAgentCommand] = useState<string>(DEFAULT_AGENT_COMMAND);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [value]);

  const trimmed = value.trim();
  const canSubmit = !isCreatingProject && trimmed.length > 0;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    const parsed = parsePromptInput(trimmed);
    if (!parsed) {
      setError("Could not interpret input — paste a GitHub URL or describe a project.");
      return;
    }
    setError(null);
    try {
      await onCreateProject({
        ...parsed,
        defaultAgentCommand: agentCommand.trim() || DEFAULT_AGENT_COMMAND,
      });
    } catch (createError) {
      setError(toErrorMessage(createError));
    }
  }, [agentCommand, canSubmit, onCreateProject, trimmed]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col items-center justify-center overflow-auto p-6">
      <form className="w-full max-w-xl" onSubmit={handleSubmit}>
        <div
          className={cn(
            "rounded-2xl border border-border/60 transition-colors",
            "bg-[var(--prompt-input-surface)]",
            "shadow-[inset_0_1px_2px_var(--prompt-input-inner-shadow)]",
            "focus-within:border-border"
          )}
        >
          <Textarea
            autoFocus
            disabled={isCreatingProject}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe a project or paste a GitHub repo URL…"
            ref={textareaRef}
            value={value}
            variant="ghost"
            className="min-h-[88px] max-h-[240px] px-5 pt-4 pb-2 font-code text-base leading-relaxed"
          />

          <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
            <AgentCommandPicker
              disabled={isCreatingProject}
              onChange={setAgentCommand}
              value={agentCommand}
            />

            <button
              disabled={!canSubmit}
              type="submit"
              className={cn(
                "h-8 rounded-md px-4 font-vcr text-xs uppercase tracking-wider transition-colors",
                "bg-foreground text-background hover:bg-foreground/90",
                "disabled:bg-secondary disabled:text-muted-foreground/40"
              )}
            >
              {isCreatingProject ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>

        {error ? (
          <p className="mt-3 px-1 font-code text-sm text-destructive">{error}</p>
        ) : (
          <p className="mt-3 px-1 font-code text-xs text-muted-foreground/40">
            ⌘↩ to create
          </p>
        )}
      </form>
    </section>
  );
}

import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Textarea } from "@weekend/design";
import { Combobox, type ComboboxItem } from "@weekend/design/registry";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CreateProjectInput } from "@/lib/controller";

const MAX_TEXTAREA_HEIGHT = 240;

const AGENT_COMMAND_ITEMS: ReadonlyArray<ComboboxItem> = [
  { value: "claude", label: "claude" },
  {
    value: "claude --dangerously-skip-permissions",
    label: "claude --dangerously-skip-permissions",
  },
  { value: "codex", label: "codex" },
];

const DEFAULT_AGENT_COMMAND = AGENT_COMMAND_ITEMS[0]!.value;

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
            className="min-h-[88px] max-h-[240px] px-4 pt-3 pb-2 font-code text-base leading-relaxed"
          />

          <div className="flex items-center justify-between gap-2 px-4 pt-1 pb-3">
            <Combobox
              variant="ghost"
              disabled={isCreatingProject}
              items={AGENT_COMMAND_ITEMS}
              onChange={setAgentCommand}
              value={agentCommand}
              placeholder="agent command"
              popoverWidth={320}
              className="h-8 font-code text-xs normal-case"
            />

            <Button
              disabled={!canSubmit}
              type="submit"
              variant="default"
              size="default"
              className="h-8 px-4 font-vcr text-xs uppercase tracking-wider"
            >
              {isCreatingProject ? "Submitting…" : "Submit"}
            </Button>
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

import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ArrowRight } from "lucide-react";
import { Combobox, type ComboboxItem } from "@weekend/design/registry";
import { WeekendWordmark } from "@/components/branding/weekend-wordmark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CreateProjectInput, DesignSystemChoice } from "@/lib/controller";

const MAX_TEXTAREA_HEIGHT = 240;
const MIN_TEXTAREA_HEIGHT = 96;

const AGENT_COMMAND_ITEMS: ReadonlyArray<ComboboxItem> = [
  { value: "claude", label: "claude" },
  {
    value: "claude --dangerously-skip-permissions",
    label: "claude --dangerously-skip-permissions",
  },
  { value: "codex", label: "codex" },
];

const DEFAULT_AGENT_COMMAND = AGENT_COMMAND_ITEMS[0]!.value;

const DESIGN_SYSTEM_ITEMS: ReadonlyArray<ComboboxItem> = [
  { value: "weekend", label: "@weekend/design" },
  { value: "none", label: "no design system" },
];

const DEFAULT_DESIGN_SYSTEM: DesignSystemChoice = "weekend";

const PROJECT_NAME_RE = /^[a-z0-9][a-z0-9_-]*$/;

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

function extractGithubUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(GITHUB_URL_RE);
  if (!match) return null;
  return match[0].replace(/[)\].,;]+$/, "");
}

function suggestNameFromGithub(url: string): string {
  const match = url.match(GITHUB_URL_RE);
  return slugify(match?.[2] ?? "") || "project";
}

export function HomePage({
  isCreatingProject,
  onCreateProject,
}: {
  isCreatingProject: boolean;
  onCreateProject: (input: CreateProjectInput) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [agentCommand, setAgentCommand] = useState<string>(DEFAULT_AGENT_COMMAND);
  const [designSystem, setDesignSystem] =
    useState<DesignSystemChoice>(DEFAULT_DESIGN_SYSTEM);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.max(
      MIN_TEXTAREA_HEIGHT,
      Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT),
    );
    el.style.height = `${next}px`;
  }, [value]);

  const trimmedPrompt = value.trim();
  const trimmedName = name.trim().toLowerCase();

  useEffect(() => {
    if (nameTouched) return;
    const url = extractGithubUrl(trimmedPrompt);
    if (url) {
      setName(suggestNameFromGithub(url));
    }
  }, [nameTouched, trimmedPrompt]);

  const nameValid = PROJECT_NAME_RE.test(trimmedName);
  const canSubmit =
    !isCreatingProject && trimmedPrompt.length > 0 && nameValid;

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
    setNameTouched(true);
  };

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    const githubRepoUrl = extractGithubUrl(trimmedPrompt);
    setError(null);
    try {
      await onCreateProject({
        name: trimmedName,
        githubRepoUrl: githubRepoUrl ?? undefined,
        initialPrompt: trimmedPrompt,
        defaultAgentCommand: agentCommand.trim() || DEFAULT_AGENT_COMMAND,
        designSystem,
      });
    } catch (createError) {
      setError(toErrorMessage(createError));
    }
  }, [
    agentCommand,
    canSubmit,
    designSystem,
    onCreateProject,
    trimmedName,
    trimmedPrompt,
  ]);

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
      <div className="relative mb-8 inline-block text-foreground">
        <WeekendWordmark className="block h-9 w-auto" />
        <img
          src="/logo-face.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -top-2 -right-7 h-7 w-7 object-contain"
        />
      </div>
      <form className="w-full max-w-[560px]" onSubmit={handleSubmit}>
        <div
          className={cn(
            "overflow-hidden rounded-2xl border border-border/60 transition-[border-color,box-shadow] duration-150",
            "bg-[var(--prompt-input-surface)]",
            "shadow-[inset_0_1px_2px_var(--prompt-input-inner-shadow)]",
            "focus-within:border-border focus-within:ring-2 focus-within:ring-ring/15 focus-within:ring-offset-0",
          )}
        >
          <input
            id="project-name"
            autoComplete="off"
            spellCheck={false}
            disabled={isCreatingProject}
            onChange={handleNameChange}
            placeholder="project-name"
            value={name}
            className={cn(
              "block w-full border-b border-border/30 bg-transparent px-4 py-2.5 font-code text-[13px] leading-tight outline-none",
              "placeholder:text-muted-foreground/35",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />

          <textarea
            ref={textareaRef}
            autoFocus
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={isCreatingProject}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="describe what you want to build…"
            value={value}
            style={{ minHeight: MIN_TEXTAREA_HEIGHT, maxHeight: MAX_TEXTAREA_HEIGHT }}
            className={cn(
              "block w-full resize-none border-0 bg-transparent px-4 py-2.5 font-code text-[13px] leading-relaxed outline-none",
              "placeholder:text-muted-foreground/40",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />

          <div className="flex items-center justify-between gap-2 px-2 py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <Combobox
                variant="ghost"
                disabled={isCreatingProject}
                items={AGENT_COMMAND_ITEMS}
                onChange={setAgentCommand}
                value={agentCommand}
                placeholder="agent"
                popoverWidth={320}
                className="h-7 font-code text-[11px] normal-case text-muted-foreground"
              />
              <span className="font-code text-[11px] text-muted-foreground/30">
                ·
              </span>
              <Combobox
                variant="ghost"
                disabled={isCreatingProject}
                items={DESIGN_SYSTEM_ITEMS}
                onChange={(next) => setDesignSystem(next as DesignSystemChoice)}
                value={designSystem}
                placeholder="design"
                popoverWidth={220}
                className="h-7 font-code text-[11px] normal-case text-muted-foreground"
              />
            </div>

            <Button
              disabled={!canSubmit}
              type="submit"
              variant="default"
              size="sm"
              trailingIcon={ArrowRight}
            >
              {isCreatingProject ? "Creating" : "Create"}
            </Button>
          </div>
        </div>

        <div className="mt-2.5 flex min-h-[18px] items-center px-1">
          {error ? (
            <p className="font-code text-xs text-destructive">{error}</p>
          ) : nameTouched && trimmedName.length > 0 && !nameValid ? (
            <p className="font-code text-xs text-muted-foreground/60">
              lowercase letters, digits, dashes, underscores only
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

import { type FormEvent, useState } from "react";
import { Input } from "@/components/ui/input";
import type { CreateProjectInput } from "@/lib/controller";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function looksLikeGithubRepoUrl(value: string): boolean {
  return (
    value.startsWith("https://github.com/") ||
    value.startsWith("http://github.com/") ||
    value.startsWith("git@github.com:")
  );
}

export function HomePage({
  isCreatingProject,
  onCreateProject,
}: {
  isCreatingProject: boolean;
  onCreateProject: (input: CreateProjectInput) => Promise<void>;
}) {
  const [projectName, setProjectName] = useState("");
  const [defaultAgentCommand, setDefaultAgentCommand] = useState("claude");
  const [githubRepoUrl, setGithubRepoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCreatingProject) return;

    const name = projectName.trim();
    const agentCommand = defaultAgentCommand.trim();
    const repoUrl = githubRepoUrl.trim();

    if (!name) {
      setError("Project name is required.");
      return;
    }
    if (!agentCommand) {
      setError("Default agent command is required.");
      return;
    }
    if (repoUrl && !looksLikeGithubRepoUrl(repoUrl)) {
      setError(
        "GitHub repo URL must start with https://github.com/ or git@github.com:."
      );
      return;
    }

    setError(null);

    try {
      await onCreateProject({
        name,
        defaultAgentCommand: agentCommand,
        githubRepoUrl: repoUrl || undefined,
      });
    } catch (createError) {
      setError(toErrorMessage(createError));
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col items-center justify-center overflow-auto p-6">
      <form className="w-full max-w-lg" onSubmit={handleSubmit}>
        <div className="rounded-2xl border border-border/60">
          <label className="block px-5 py-4">
            <span className="font-vcr text-xs text-muted-foreground/60">
              PROJECT NAME
            </span>
            <Input
              autoFocus
              disabled={isCreatingProject}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="my-app"
              value={projectName}
              variant="ghost"
              className="mt-1 h-9 px-0 font-code text-base"
            />
          </label>

          <div className="border-t border-border/40" />

          <label className="block px-5 py-4">
            <span className="font-vcr text-xs text-muted-foreground/60">
              AGENT COMMAND
            </span>
            <Input
              disabled={isCreatingProject}
              onChange={(event) => setDefaultAgentCommand(event.target.value)}
              placeholder="claude"
              value={defaultAgentCommand}
              variant="ghost"
              className="mt-1 h-9 px-0 font-code text-base"
            />
          </label>

          <div className="border-t border-border/40" />

          <label className="block px-5 py-4">
            <div className="flex items-baseline gap-2">
              <span className="font-vcr text-xs text-muted-foreground/60">
                GITHUB REPO
              </span>
              <span className="font-code text-[11px] text-muted-foreground/30">
                optional
              </span>
            </div>
            <Input
              disabled={isCreatingProject}
              onChange={(event) => setGithubRepoUrl(event.target.value)}
              placeholder="https://github.com/owner/repo"
              type="text"
              value={githubRepoUrl}
              variant="ghost"
              className="mt-1 h-9 px-0 font-code text-base"
            />
          </label>

          {error ? (
            <>
              <div className="border-t border-border/40" />
              <p className="px-5 py-3 font-code text-sm text-destructive">{error}</p>
            </>
          ) : null}

          <button
            disabled={isCreatingProject}
            type="submit"
            className="flex w-full items-center justify-center border-t border-border/40 px-5 py-7 font-vcr text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            {isCreatingProject ? "CREATING..." : "CREATE"}
          </button>
        </div>
      </form>
    </section>
  );
}

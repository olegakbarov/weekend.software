import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Check, Copy, RefreshCw, Terminal, Trash2 } from "lucide-react";
import { useTheme } from "@/components/theme/use-theme";
import { terminalRegistry } from "@/lib/terminal-registry";
import type { WorkspaceController } from "@/hooks/use-workspace-controller";

// ── Types ──

type InstalledSkill = {
  name: string;
  description: string;
  path: string;
};

type ProjectTreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  children: ProjectTreeNode[];
};

// ── Helpers ──

function parseSkillFrontmatter(content: string): {
  name: string;
  description: string;
} | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;
  const frontmatter = match[1];

  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
  if (!nameMatch) return null;

  return {
    name: nameMatch[1].trim().replace(/^["']|["']$/g, ""),
    description: descMatch
      ? descMatch[1].trim().replace(/^["']|["']$/g, "")
      : "",
  };
}

function findSkillFiles(nodes: ProjectTreeNode[], prefix = ""): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    const fullPath = prefix ? `${prefix}/${node.name}` : node.name;
    if (!node.isDir && node.name === "SKILL.md") {
      paths.push(fullPath);
    }
    if (node.isDir && node.children.length > 0) {
      paths.push(...findSkillFiles(node.children, fullPath));
    }
  }
  return paths;
}

function findSkillsSubtree(
  tree: ProjectTreeNode[]
): ProjectTreeNode[] | null {
  const claude = tree.find((n) => n.isDir && n.name === ".claude");
  if (!claude) return null;
  const skills = claude.children.find((n) => n.isDir && n.name === "skills");
  if (!skills) return null;
  return skills.children;
}

// ── Small components ──

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
      onClick={handleCopy}
      title="Copy"
      type="button"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
    </button>
  );
}

function CommandRow({
  command,
  terminalId,
}: {
  command: string;
  terminalId: string | null;
}) {
  return (
    <div className="group flex items-center gap-2">
      <button
        className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-left transition-colors hover:bg-secondary/60"
        onClick={() => {
          if (!terminalId) return;
          terminalRegistry.sendCommand(terminalId, `${command}\n`);
        }}
        type="button"
      >
        <code className="truncate font-code text-[13px] text-foreground">
          {command}
        </code>
      </button>
      <CopyButton text={command} />
    </div>
  );
}

// ── Installed skill row ──

function InstalledSkillRow({
  skill,
  terminalId,
}: {
  skill: InstalledSkill;
  terminalId: string | null;
}) {
  return (
    <div className="group flex items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-secondary/40">
      <div className="min-w-0 flex-1">
        <p className="truncate font-code text-[13px] text-foreground">
          {skill.name}
        </p>
        {skill.description && (
          <p className="mt-0.5 truncate font-code text-[11px] text-muted-foreground">
            {skill.description}
          </p>
        )}
      </div>
      <button
        className="shrink-0 rounded p-0.5 text-muted-foreground/50 opacity-0 transition-all group-hover:opacity-100 hover:text-destructive"
        onClick={() => {
          if (!terminalId) return;
          terminalRegistry.sendCommand(
            terminalId,
            `npx skills remove -s '${skill.name}' -a claude-code -y\n`
          );
        }}
        title={`Remove ${skill.name}`}
        type="button"
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}

// ── Popular skill row ──

function PopularSkillRow({
  repo,
  desc,
  terminalId,
}: {
  repo: string;
  desc: string;
  terminalId: string | null;
}) {
  return (
    <button
      className="group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-secondary/40"
      onClick={() => {
        if (!terminalId) return;
        terminalRegistry.sendCommand(
          terminalId,
          `npx skills add ${repo} -a claude-code -y\n`
        );
      }}
      type="button"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-code text-[13px] text-foreground">
          {repo}
        </p>
        <p className="mt-0.5 truncate font-code text-[11px] text-muted-foreground">
          {desc}
        </p>
      </div>
      <Terminal className="size-3 shrink-0 text-muted-foreground/50 opacity-0 transition-all group-hover:opacity-100" />
    </button>
  );
}

// ── Embedded Terminal ──

function SkillsTerminal({
  terminalId,
  project,
}: {
  terminalId: string;
  project: string;
}) {
  const { activeTheme } = useTheme();
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
    terminalRegistry.refreshTheme();
  }, [activeTheme]);

  return (
    <div className="h-full min-h-0 w-full bg-transparent px-3 py-2">
      <div className="h-full w-full cursor-text" ref={containerRef} />
    </div>
  );
}

// ── Hook: load installed skills ──

function useInstalledSkills(project: string) {
  const [skills, setSkills] = useState<InstalledSkill[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const tree = await invoke<ProjectTreeNode[]>("list_project_tree", {
        project,
      });
      const skillsSubtree = findSkillsSubtree(tree);
      if (!skillsSubtree || skillsSubtree.length === 0) {
        setSkills([]);
        return;
      }

      const skillPaths = findSkillFiles(skillsSubtree, ".claude/skills");
      const loaded: InstalledSkill[] = [];

      for (const path of skillPaths) {
        try {
          const content = await invoke<string>("read_project_file", {
            project,
            path,
          });
          const parsed = parseSkillFrontmatter(content);
          if (parsed) {
            loaded.push({ ...parsed, path });
          }
        } catch {
          // skip unreadable files
        }
      }

      setSkills(loaded);
    } catch {
      setSkills([]);
    } finally {
      setIsLoading(false);
    }
  }, [project]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { skills, isLoading, refresh };
}

// ── Section label ──

function SectionLabel({
  children,
  action,
}: {
  children: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-2 pb-1">
      <span className="font-vcr text-[12px] text-muted-foreground">
        {children}
      </span>
      {action}
    </div>
  );
}

// ── Main Page ──

const POPULAR_SKILLS = [
  {
    repo: "vercel-labs/agent-skills",
    desc: "Design, testing, code review",
  },
  {
    repo: "anthropic/skills",
    desc: "Code review, quality",
  },
];

export function ProjectSkillsPage({
  project,
  controller,
}: {
  project: string;
  controller: WorkspaceController;
}) {
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const { skills, isLoading, refresh } = useInstalledSkills(project);

  useEffect(() => {
    const descriptor = controller.createTerminalSession(project, "skills");
    setTerminalId(descriptor.terminalId);

    return () => {
      controller.removeTerminalSession(descriptor.terminalId);
    };
  }, [controller, project]);

  return (
    <div className="flex h-full min-h-0 w-full flex-1">
      {/* Left column */}
      <div className="flex w-64 shrink-0 flex-col border-r border-border">
        <div className="min-h-0 flex-1 overflow-auto py-3">
          {/* Installed */}
          <div>
            <SectionLabel
              action={
                <button
                  className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => void refresh()}
                  title="Refresh"
                  type="button"
                >
                  <RefreshCw
                    className={`size-2.5 ${isLoading ? "animate-spin" : ""}`}
                  />
                </button>
              }
            >
              Installed
            </SectionLabel>

            <div className="px-1">
              {skills.length === 0 ? (
                <p className="px-2 py-3 text-center font-code text-[12px] text-muted-foreground">
                  {isLoading ? "Scanning..." : "No skills installed"}
                </p>
              ) : (
                skills.map((skill) => (
                  <InstalledSkillRow
                    key={skill.path}
                    skill={skill}
                    terminalId={terminalId}
                  />
                ))
              )}
            </div>
          </div>

          {/* Popular */}
          <div className="mt-4">
            <SectionLabel>Popular</SectionLabel>
            <div className="px-1">
              {POPULAR_SKILLS.map((s) => (
                <PopularSkillRow
                  key={s.repo}
                  repo={s.repo}
                  desc={s.desc}
                  terminalId={terminalId}
                />
              ))}
            </div>
          </div>

          {/* Commands */}
          <div className="mt-4">
            <SectionLabel>Commands</SectionLabel>
            <div className="px-1">
              <CommandRow
                command="npx skills add <owner/repo>"
                terminalId={terminalId}
              />
              <CommandRow
                command="npx skills find"
                terminalId={terminalId}
              />
              <CommandRow
                command="npx skills update"
                terminalId={terminalId}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-3 py-2">
          <p className="font-code text-[11px] text-muted-foreground">
            .claude/skills/
          </p>
        </div>
      </div>

      {/* Right column — blended terminal */}
      <div className="min-h-0 min-w-0 flex-1">
        {terminalId ? (
          <SkillsTerminal terminalId={terminalId} project={project} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="font-code text-[10px] text-muted-foreground">
              Initializing terminal...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

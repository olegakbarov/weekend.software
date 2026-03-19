import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Download,
  Check,
  Star,
  ExternalLink,
  Globe,
  FolderOpen,
} from "lucide-react";

// ── Types ──

type SkillCategory =
  | "all"
  | "coding"
  | "devops"
  | "design"
  | "data"
  | "productivity";

type InstallScope = "project" | "global";

type Skill = {
  id: string;
  name: string;
  description: string;
  author: string;
  category: SkillCategory;
  installs: string;
  stars: number;
  tags: string[];
  repo: string;
  installed?: InstallScope | null;
};

// ── Mock Data ──

const SKILLS: Skill[] = [
  {
    id: "find-skills",
    name: "find-skills",
    description:
      "Discover and install specialized agent skills from the open ecosystem.",
    author: "vercel-labs",
    category: "productivity",
    installs: "621.4K",
    stars: 10800,
    tags: ["discovery", "ecosystem"],
    repo: "vercel-labs/skills",
  },
  {
    id: "frontend-design",
    name: "frontend-design",
    description:
      "Create distinctive, production-grade frontend interfaces with high design quality.",
    author: "vercel-labs",
    category: "design",
    installs: "412.1K",
    stars: 8200,
    tags: ["ui", "react", "css"],
    repo: "vercel-labs/skills",
  },
  {
    id: "code-review",
    name: "code-review",
    description:
      "Comprehensive code review focused on quality, performance, security, and consistency.",
    author: "anthropic",
    category: "coding",
    installs: "389.7K",
    stars: 7100,
    tags: ["review", "quality"],
    repo: "anthropic/skills",
  },
  {
    id: "docker-deploy",
    name: "docker-deploy",
    description:
      "Build, optimize, and deploy Docker containers with multi-stage builds and caching.",
    author: "community",
    category: "devops",
    installs: "215.3K",
    stars: 4300,
    tags: ["docker", "deploy", "ci/cd"],
    repo: "community/docker-skills",
  },
  {
    id: "test-pyramid",
    name: "test-pyramid",
    description:
      "Implement comprehensive test pyramids with parallel subagents for speed.",
    author: "vercel-labs",
    category: "coding",
    installs: "187.9K",
    stars: 3800,
    tags: ["testing", "playwright", "vitest"],
    repo: "vercel-labs/skills",
  },
  {
    id: "data-pipeline",
    name: "data-pipeline",
    description:
      "Design and implement ETL/ELT data pipelines with validation and error recovery.",
    author: "community",
    category: "data",
    installs: "143.2K",
    stars: 2900,
    tags: ["etl", "pipeline", "analytics"],
    repo: "community/data-skills",
  },
  {
    id: "api-design",
    name: "api-design",
    description:
      "Design RESTful and GraphQL APIs with OpenAPI specs, versioning, and pagination.",
    author: "vercel-labs",
    category: "coding",
    installs: "298.4K",
    stars: 5600,
    tags: ["api", "rest", "graphql"],
    repo: "vercel-labs/skills",
  },
  {
    id: "k8s-operator",
    name: "k8s-operator",
    description:
      "Build and manage Kubernetes operators, custom resources, and helm charts.",
    author: "community",
    category: "devops",
    installs: "98.1K",
    stars: 2100,
    tags: ["kubernetes", "helm", "cloud"],
    repo: "community/k8s-skills",
  },
  {
    id: "accessibility-audit",
    name: "accessibility-audit",
    description:
      "Run WCAG accessibility audits for color contrast, keyboard nav, and screen readers.",
    author: "vercel-labs",
    category: "design",
    installs: "156.8K",
    stars: 3200,
    tags: ["a11y", "wcag", "audit"],
    repo: "vercel-labs/skills",
  },
  {
    id: "sql-optimizer",
    name: "sql-optimizer",
    description:
      "Analyze and optimize SQL queries. Identifies N+1 problems and suggests indexes.",
    author: "community",
    category: "data",
    installs: "112.5K",
    stars: 2400,
    tags: ["sql", "performance", "database"],
    repo: "community/data-skills",
  },
];

const CATEGORIES: { value: SkillCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "coding", label: "Coding" },
  { value: "devops", label: "DevOps" },
  { value: "design", label: "Design" },
  { value: "data", label: "Data" },
  { value: "productivity", label: "Productivity" },
];

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ── Skill Row ──

function SkillRow({
  skill,
  onInstall,
  onSelect,
  isSelected,
}: {
  skill: Skill;
  onInstall: (id: string, scope: InstallScope) => void;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const [showScopeMenu, setShowScopeMenu] = useState(false);

  return (
    <div
      className={`flex items-center gap-3 rounded border px-3 py-2 transition-colors cursor-pointer ${
        isSelected
          ? "border-border bg-muted/50"
          : "border-border/40 hover:border-border/70 hover:bg-muted/30"
      }`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelect();
      }}
      role="button"
      tabIndex={0}
    >
      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-code text-[11px] font-medium text-foreground">
            {skill.author}/{skill.name}
          </span>
          {skill.tags.map((tag) => (
            <Badge
              key={tag}
              className="hidden shrink-0 px-1 py-0 font-code text-[9px] sm:inline-flex"
              variant="secondary"
            >
              {tag}
            </Badge>
          ))}
        </div>
        <p className="mt-0.5 truncate font-code text-[10px] text-muted-foreground">
          {skill.description}
        </p>
      </div>

      {/* Stats */}
      <div className="hidden shrink-0 items-center gap-3 font-code text-[10px] text-muted-foreground/70 md:flex">
        <span className="flex items-center gap-0.5">
          <Download className="size-2.5" />
          {skill.installs}
        </span>
        <span className="flex items-center gap-0.5">
          <Star className="size-2.5" />
          {formatStars(skill.stars)}
        </span>
      </div>

      {/* Action */}
      <div
        className="shrink-0"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {skill.installed ? (
          <Badge variant="success" className="gap-0.5 px-1.5 py-0 font-code text-[9px]">
            <Check className="size-2" />
            {skill.installed === "global" ? "Global" : "Project"}
          </Badge>
        ) : (
          <div className="relative">
            <Button
              size="xs"
              variant="outline"
              className="h-5 gap-0.5 px-1.5 font-code text-[9px]"
              onClick={() => setShowScopeMenu(!showScopeMenu)}
            >
              <Download className="size-2.5" />
              Install
            </Button>
            {showScopeMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowScopeMenu(false)}
                  onKeyDown={() => setShowScopeMenu(false)}
                  role="button"
                  tabIndex={-1}
                  aria-label="Close menu"
                />
                <div className="absolute right-0 top-full mt-1 z-20 flex flex-col rounded border border-border bg-background py-0.5 shadow-md">
                  <button
                    className="flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 font-code text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => {
                      onInstall(skill.id, "project");
                      setShowScopeMenu(false);
                    }}
                    type="button"
                  >
                    <FolderOpen className="size-2.5" />
                    This project
                  </button>
                  <button
                    className="flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 font-code text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => {
                      onInstall(skill.id, "global");
                      setShowScopeMenu(false);
                    }}
                    type="button"
                  >
                    <Globe className="size-2.5" />
                    Global
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Skill Detail Panel ──

function SkillDetail({
  skill,
  onInstall,
  onClose,
}: {
  skill: Skill;
  onInstall: (id: string, scope: InstallScope) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-l border-border/40">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <span className="font-code text-[11px] font-medium text-foreground">
          {skill.author}/{skill.name}
        </span>
        <button
          className="font-code text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          onClick={onClose}
          type="button"
        >
          close
        </button>
      </div>

      <div className="flex-1 overflow-auto px-3 py-3">
        {/* Install command */}
        <div className="rounded border border-border/40 bg-muted/40 px-2.5 py-1.5">
          <code className="font-mono text-[10px] text-foreground/80">
            skills add {skill.author}/{skill.name}
          </code>
        </div>

        {/* Description */}
        <p className="mt-3 font-code text-[10px] leading-relaxed text-muted-foreground">
          {skill.description}
        </p>

        {/* Metadata */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between font-code text-[10px]">
            <span className="text-muted-foreground/70">installs</span>
            <span className="text-foreground">{skill.installs}</span>
          </div>
          <div className="flex items-center justify-between font-code text-[10px]">
            <span className="text-muted-foreground/70">repo</span>
            <span className="flex items-center gap-0.5 text-foreground">
              {skill.repo}
              <ExternalLink className="size-2 text-muted-foreground/50" />
            </span>
          </div>
          <div className="flex items-center justify-between font-code text-[10px]">
            <span className="text-muted-foreground/70">stars</span>
            <span className="flex items-center gap-0.5 text-foreground">
              <Star className="size-2" />
              {formatStars(skill.stars)}
            </span>
          </div>
        </div>

        {/* Tags */}
        <div className="mt-3 flex flex-wrap gap-1">
          {skill.tags.map((tag) => (
            <Badge
              key={tag}
              className="px-1 py-0 font-code text-[9px]"
              variant="secondary"
            >
              {tag}
            </Badge>
          ))}
        </div>

        {/* Install buttons */}
        <div className="mt-4 flex flex-col gap-1.5">
          {skill.installed ? (
            <Badge
              variant="success"
              className="justify-center gap-1 py-1 font-code text-[10px]"
            >
              <Check className="size-2.5" />
              Installed ({skill.installed})
            </Badge>
          ) : (
            <>
              <Button
                size="xs"
                className="w-full gap-1 font-code text-[10px]"
                onClick={() => onInstall(skill.id, "project")}
              >
                <FolderOpen className="size-2.5" />
                Install for project
              </Button>
              <Button
                size="xs"
                variant="outline"
                className="w-full gap-1 font-code text-[10px]"
                onClick={() => onInstall(skill.id, "global")}
              >
                <Globe className="size-2.5" />
                Install globally
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──

export function SkillsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<SkillCategory>("all");
  const [installedSkills, setInstalledSkills] = useState<
    Record<string, InstallScope>
  >({});
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  const skills = useMemo(() => {
    return SKILLS.map((s) => ({
      ...s,
      installed: installedSkills[s.id] ?? null,
    }));
  }, [installedSkills]);

  const filtered = useMemo(() => {
    return skills.filter((s) => {
      const matchesCategory = category === "all" || s.category === category;
      const matchesSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase()) ||
        s.author.toLowerCase().includes(search.toLowerCase()) ||
        s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [skills, category, search]);

  const selectedSkill = selectedSkillId
    ? skills.find((s) => s.id === selectedSkillId) ?? null
    : null;

  const handleInstall = (id: string, scope: InstallScope) => {
    setInstalledSkills((prev) => ({ ...prev, [id]: scope }));
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 space-y-2 px-4 pt-4 pb-3">
        <div>
          <h1 className="font-code text-xs text-foreground">Skills</h1>
          <p className="font-code text-[10px] text-muted-foreground/70">
            Discover and install agent skills to extend capabilities.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            className="h-7 pl-8 font-code text-[10px]"
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-0.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`rounded px-2 py-0.5 font-code text-[10px] transition-colors ${
                category === c.value
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground/60 hover:text-muted-foreground"
              }`}
              type="button"
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex min-h-0 flex-1 border-t border-border/30">
        {/* Skill list */}
        <div className="min-h-0 min-w-0 flex-1 overflow-auto px-4 py-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="font-code text-[11px] text-muted-foreground">
                No skills found
              </p>
              <p className="font-code text-[10px] text-muted-foreground/50">
                Try adjusting your search or filter.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filtered.map((skill) => (
                <SkillRow
                  key={skill.id}
                  skill={skill}
                  isSelected={selectedSkillId === skill.id}
                  onInstall={handleInstall}
                  onSelect={() => setSelectedSkillId(skill.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedSkill && (
          <div className="hidden w-64 shrink-0 md:block">
            <SkillDetail
              skill={selectedSkill}
              onInstall={handleInstall}
              onClose={() => setSelectedSkillId(null)}
            />
          </div>
        )}
      </div>
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Archive, Save, Trash2 } from "lucide-react";
import {
  InputCopy,
  TabItem,
  TabPanel,
  Tabs,
  TabsList,
} from "@weekend/design/registry";
import { Button } from "@/components/ui/button";
import { EnvVarsEditor } from "@/components/ui/env-vars-editor";
import { Input } from "@/components/ui/input";
import { ProjectSkillsPage } from "@/components/skills/project-skills-page";
import type { WorkspaceController } from "@/hooks/use-workspace-controller";
import type {
  DesignSystemChoice,
  ProjectConfigReadSnapshot,
  ProjectThemeConfigSnapshot,
} from "@/lib/controller";

const DEFAULT_PORTLESS_PROXY_PORT = 1355;
const DEFAULT_PROJECT_THEME: ProjectThemeConfigSnapshot = {
  trackShell: true,
  designSystem: "weekend",
  deploy: "none",
  cssVariables: {},
  themeVariables: {},
};

function sortObject(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, sortObject(entry)])
  );
}

function formatJson(value: unknown): string {
  return JSON.stringify(sortObject(value ?? {}), null, 2);
}

function parseStringRecord(label: string, raw: string): Record<string, string> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!/^--[A-Za-z0-9_-]+$/.test(key)) {
      throw new Error(`${label} keys must be CSS variables like --primary.`);
    }
    if (typeof value !== "string") {
      throw new Error(`${label} values must be strings.`);
    }
    result[key] = value;
  }
  return result;
}

function parseThemeVariables(raw: string): Record<string, Record<string, string>> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Per-theme variables must be a JSON object.");
  }
  const result: Record<string, Record<string, string>> = {};
  for (const [themeName, variables] of Object.entries(parsed)) {
    result[themeName] = parseStringRecord(
      `Variables for ${themeName}`,
      JSON.stringify(variables)
    );
  }
  return result;
}

function localRuntimeAddressForProject(project: string): string {
  const normalized = project
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const slug = normalized || "app";
  return `http://${slug}.localhost:${DEFAULT_PORTLESS_PROXY_PORT}`;
}

export type ProjectSettingsPageProps = {
  project: string;
  controller: WorkspaceController;
  projectConfigSnapshot: ProjectConfigReadSnapshot | null;
  isArchivingProject: boolean;
  onArchiveProject: () => Promise<void>;
  isDeletingProject: boolean;
  onDeleteProject: () => Promise<void>;
  onUpdateEnv: (env: Record<string, string>) => Promise<void>;
  onUpdateDeployUrl: (deployUrl: string | null) => Promise<void>;
  onUpdateTheme: (theme: ProjectThemeConfigSnapshot) => Promise<void>;
};

export function ProjectSettingsPage({
  project,
  controller,
  projectConfigSnapshot,
  isArchivingProject,
  onArchiveProject,
  isDeletingProject,
  onDeleteProject,
  onUpdateEnv,
  onUpdateDeployUrl,
  onUpdateTheme,
}: ProjectSettingsPageProps) {
  const currentDeployUrl = projectConfigSnapshot?.deployUrl?.trim() ?? "";
  const currentTheme = projectConfigSnapshot?.theme ?? DEFAULT_PROJECT_THEME;
  const currentDesignSystem: DesignSystemChoice =
    currentTheme.designSystem === "none" ? "none" : "weekend";
  const [activeTab, setActiveTab] = useState<"general" | "skills">("general");
  const [deployUrlDraft, setDeployUrlDraft] = useState(currentDeployUrl);
  const [deployUrlError, setDeployUrlError] = useState<string | null>(null);
  const [isDeployUrlSaving, setIsDeployUrlSaving] = useState(false);
  const [trackShellDraft, setTrackShellDraft] = useState(currentTheme.trackShell);
  const [designSystemDraft, setDesignSystemDraft] =
    useState<DesignSystemChoice>(currentDesignSystem);
  const [cssVariablesDraft, setCssVariablesDraft] = useState(
    formatJson(currentTheme.cssVariables)
  );
  const [themeVariablesDraft, setThemeVariablesDraft] = useState(
    formatJson(currentTheme.themeVariables)
  );
  const [themeError, setThemeError] = useState<string | null>(null);
  const [isThemeSaving, setIsThemeSaving] = useState(false);
  const runtimeAddress = useMemo(
    () =>
      projectConfigSnapshot?.runtimeUrl?.trim() ||
      localRuntimeAddressForProject(project),
    [project, projectConfigSnapshot?.runtimeUrl]
  );
  const normalizedDeployUrlDraft = deployUrlDraft.trim();
  const hasDeployUrlChanges = normalizedDeployUrlDraft !== currentDeployUrl;
  const currentCssVariablesText = formatJson(currentTheme.cssVariables);
  const currentThemeVariablesText = formatJson(currentTheme.themeVariables);
  const hasThemeChanges =
    trackShellDraft !== currentTheme.trackShell ||
    designSystemDraft !== currentDesignSystem ||
    cssVariablesDraft.trim() !== currentCssVariablesText ||
    themeVariablesDraft.trim() !== currentThemeVariablesText;

  useEffect(() => {
    setDeployUrlDraft(currentDeployUrl);
    setDeployUrlError(null);
  }, [currentDeployUrl, project]);

  useEffect(() => {
    setTrackShellDraft(currentTheme.trackShell);
    setDesignSystemDraft(currentDesignSystem);
    setCssVariablesDraft(currentCssVariablesText);
    setThemeVariablesDraft(currentThemeVariablesText);
    setThemeError(null);
  }, [
    currentCssVariablesText,
    currentDesignSystem,
    currentTheme.trackShell,
    currentThemeVariablesText,
    project,
  ]);

  const handleSaveDeployUrl = async () => {
    if (!hasDeployUrlChanges || isDeployUrlSaving) return;
    setIsDeployUrlSaving(true);
    setDeployUrlError(null);
    try {
      await onUpdateDeployUrl(normalizedDeployUrlDraft || null);
    } catch (error) {
      setDeployUrlError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsDeployUrlSaving(false);
    }
  };

  const handleSaveTheme = async () => {
    if (!hasThemeChanges || isThemeSaving) return;
    setIsThemeSaving(true);
    setThemeError(null);
    try {
      await onUpdateTheme({
        trackShell: trackShellDraft,
        designSystem: designSystemDraft,
        deploy: currentTheme.deploy ?? "none",
        cssVariables: parseStringRecord("CSS variables", cssVariablesDraft),
        themeVariables: parseThemeVariables(themeVariablesDraft),
      });
    } catch (error) {
      setThemeError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsThemeSaving(false);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden p-6">
      <div>
        <h1 className="font-code text-sm text-foreground">Project Settings</h1>
        <p className="mt-1 font-code text-xs text-muted-foreground">{project}</p>
      </div>

      <Tabs
        className="mt-4 min-h-0 flex-1"
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "general" | "skills")}
      >
        <TabsList>
          <TabItem value="general" label="General" />
          <TabItem value="skills" label="Skills" />
        </TabsList>

        <TabPanel className="mt-4 overflow-auto" value="general">
          <div className="mx-auto w-full max-w-2xl space-y-3">
            <div className="rounded border border-border/70 bg-background/60 px-3 py-2.5">
              <div className="mb-2">
                <p className="font-code text-xs text-foreground">Runtime Address</p>
                <p className="font-code text-[11px] text-muted-foreground">
                  Portless mode. Generated from the sanitized project name.
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <span className="w-20 shrink-0 font-code text-[11px] text-muted-foreground">
                    Local
                  </span>
                  <div className="min-w-0 flex-1">
                    <InputCopy value={runtimeAddress} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label
                    className="w-20 shrink-0 font-code text-[11px] text-muted-foreground"
                    htmlFor="project-deploy-url"
                  >
                    Deployed
                  </label>
                  <Input
                    className="h-8 min-w-0 flex-1 font-code text-xs"
                    id="project-deploy-url"
                    onChange={(event) => {
                      setDeployUrlDraft(event.target.value);
                      setDeployUrlError(null);
                    }}
                    placeholder="https://example.com"
                    type="url"
                    value={deployUrlDraft}
                  />
                  <Button
                    className="h-7 px-2 font-code text-[10px]"
                    disabled={!hasDeployUrlChanges || isDeployUrlSaving}
                    icon={Save}
                    loading={isDeployUrlSaving}
                    onClick={() => {
                      void handleSaveDeployUrl();
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    Save
                  </Button>
                </div>
                {deployUrlError ? (
                  <p className="pl-[5.75rem] font-code text-[11px] text-destructive/80">
                    {deployUrlError}
                  </p>
                ) : null}
              </div>
            </div>

            <EnvVarsEditor
              env={projectConfigSnapshot?.env ?? {}}
              onUpdate={onUpdateEnv}
              title="Environment Variables"
              description="Injected into all terminal sessions for this project."
            />

            <div className="rounded border border-border/70 bg-background/60 px-3 py-2.5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-code text-xs text-foreground">Design System</p>
                  <p className="font-code text-[11px] text-muted-foreground">
                    Weekend token tracking, primitives, and project CSS variable overrides.
                  </p>
                </div>
                <Button
                  className="h-7 shrink-0 px-2 font-code text-[10px]"
                  disabled={!hasThemeChanges || isThemeSaving}
                  icon={Save}
                  loading={isThemeSaving}
                  onClick={() => {
                    void handleSaveTheme();
                  }}
                  size="sm"
                  variant="ghost"
                >
                  Save
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="block space-y-1">
                  <span className="block font-code text-[11px] text-muted-foreground">
                    Theme Tracking
                  </span>
                  <div className="flex rounded border border-border/70 p-0.5">
                    {[
                      [true, "Track shell"],
                      [false, "Project-owned"],
                    ].map(([value, label]) => (
                      <button
                        className={`h-7 flex-1 rounded px-2 font-code text-[10px] transition-colors ${
                          trackShellDraft === value
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                        key={String(value)}
                        onClick={() => {
                          setTrackShellDraft(value as boolean);
                          setThemeError(null);
                        }}
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="block space-y-1">
                  <span className="block font-code text-[11px] text-muted-foreground">
                    Primitives
                  </span>
                  <div className="flex rounded border border-border/70 p-0.5">
                    {[
                      ["weekend", "Weekend"],
                      ["none", "None"],
                    ].map(([value, label]) => (
                      <button
                        className={`h-7 flex-1 rounded px-2 font-code text-[10px] transition-colors ${
                          designSystemDraft === value
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                        key={value}
                        onClick={() => {
                          setDesignSystemDraft(value as DesignSystemChoice);
                          setThemeError(null);
                        }}
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block space-y-1" htmlFor="project-css-variables">
                  <span className="block font-code text-[11px] text-muted-foreground">
                    CSS Variables
                  </span>
                  <textarea
                    className="min-h-28 w-full resize-y rounded border border-border/70 bg-background px-2 py-1.5 font-code text-[11px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring"
                    id="project-css-variables"
                    onChange={(event) => {
                      setCssVariablesDraft(event.target.value);
                      setThemeError(null);
                    }}
                    spellCheck={false}
                    value={cssVariablesDraft}
                  />
                </label>
                <label className="block space-y-1" htmlFor="project-theme-variables">
                  <span className="block font-code text-[11px] text-muted-foreground">
                    Per-theme Variables
                  </span>
                  <textarea
                    className="min-h-28 w-full resize-y rounded border border-border/70 bg-background px-2 py-1.5 font-code text-[11px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring"
                    id="project-theme-variables"
                    onChange={(event) => {
                      setThemeVariablesDraft(event.target.value);
                      setThemeError(null);
                    }}
                    spellCheck={false}
                    value={themeVariablesDraft}
                  />
                </label>
              </div>
              {themeError ? (
                <p className="mt-2 font-code text-[11px] text-destructive/80">
                  {themeError}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-3 rounded border border-border/70 bg-background/60 px-3 py-2.5">
              <div className="min-w-0">
                <p className="font-code text-xs text-foreground">Archive</p>
                <p className="font-code text-[11px] text-muted-foreground">
                  Hide from the active list. Unarchive from the sidebar.
                </p>
              </div>
              <Button
                className="h-7 shrink-0 px-2 font-code text-[10px]"
                icon={Archive}
                loading={isArchivingProject}
                onClick={() => {
                  void onArchiveProject();
                }}
                size="sm"
                variant="ghost"
              >
                Archive
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <div className="min-w-0">
                <p className="font-code text-xs text-destructive">Danger Zone</p>
                <p className="font-code text-[11px] text-muted-foreground">
                  Permanently remove the project and delete its directory.
                </p>
              </div>
              <Button
                className="h-7 shrink-0 px-2 font-code text-[10px]"
                icon={Trash2}
                loading={isDeletingProject}
                onClick={() => {
                  void onDeleteProject();
                }}
                size="sm"
                variant="destructive"
              >
                Delete
              </Button>
            </div>
          </div>
        </TabPanel>

        <TabPanel
          className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-border/70 bg-background/60"
          value="skills"
        >
          <ProjectSkillsPage project={project} controller={controller} />
        </TabPanel>
      </Tabs>
    </section>
  );
}

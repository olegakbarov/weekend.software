import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowRight } from "lucide-react";
import { Combobox, type ComboboxItem } from "@weekend/design/registry";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  AgentSettings,
  CreateProjectInput,
  DeployChoice,
  DesignSystemChoice,
} from "@/lib/controller";
import { defaultAgentProfile, findAgentProfile } from "@/lib/controller/agent-profiles";
import { deployManifestFor } from "@/lib/controller/deploy-manifests";
import {
  getPreset,
  listPresets,
  resolveManifest,
} from "@/lib/controller/presets";
import type { PresetManifest, PresetSummary } from "@/lib/controller/types";
import {
  CredsDrawer,
  type CredsDrawerSection,
  manifestFieldsValid,
} from "./creds-drawer";

const MAX_TEXTAREA_HEIGHT = 240;
const MIN_TEXTAREA_HEIGHT = 96;

const DESIGN_SYSTEM_ITEMS: ReadonlyArray<ComboboxItem> = [
  { value: "weekend", label: "@weekend/design" },
  { value: "none", label: "no design system" },
];

const DEFAULT_DESIGN_SYSTEM: DesignSystemChoice = "weekend";

const DEPLOY_ITEMS: ReadonlyArray<ComboboxItem> = [
  { value: "none", label: "no deploy" },
  { value: "cloudflare", label: "cloudflare" },
  { value: "vercel", label: "vercel" },
];

const DEFAULT_DEPLOY: DeployChoice = "none";

const PRESET_NONE = "none";

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

export type CreateProjectFromPresetInput = {
  presetId: string;
  name: string;
  fieldValues: Record<string, string>;
  initialPrompt: string;
  defaultAgentProfileId: string;
  defaultAgentCommand: string;
  additionalFileWrites?: Record<string, string>;
};

export function HomePage({
  agentSettings,
  isCreatingProject,
  onCreateProject,
  onCreateFromPreset,
}: {
  agentSettings: AgentSettings;
  isCreatingProject: boolean;
  onCreateProject: (input: CreateProjectInput) => Promise<void>;
  onCreateFromPreset: (input: CreateProjectFromPresetInput) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [agentProfileId, setAgentProfileId] = useState<string>(
    agentSettings.defaultProfileId,
  );
  const [designSystem, setDesignSystem] =
    useState<DesignSystemChoice>(DEFAULT_DESIGN_SYSTEM);
  const [deploy, setDeploy] = useState<DeployChoice>(DEFAULT_DEPLOY);
  const [presetId, setPresetId] = useState<string>(PRESET_NONE);
  const [presetSummaries, setPresetSummaries] = useState<PresetSummary[]>([]);
  const [presetManifestById, setPresetManifestById] = useState<
    Record<string, PresetManifest>
  >({});
  const [presetFieldValues, setPresetFieldValues] = useState<
    Record<string, string>
  >({});
  const [deployFieldValues, setDeployFieldValues] = useState<
    Record<string, string>
  >({});
  const [presetLoadError, setPresetLoadError] = useState<string | null>(null);
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

  useEffect(() => {
    let cancelled = false;
    listPresets()
      .then((result) => {
        if (cancelled) return;
        setPresetSummaries(result);
      })
      .catch((listError) => {
        if (cancelled) return;
        setPresetLoadError(toErrorMessage(listError));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (presetId === PRESET_NONE) return;
    if (presetManifestById[presetId]) return;
    let cancelled = false;
    getPreset(presetId)
      .then((manifest) => {
        if (cancelled) return;
        setPresetManifestById((prev) => ({ ...prev, [presetId]: manifest }));
      })
      .catch((manifestError) => {
        if (cancelled) return;
        setPresetLoadError(toErrorMessage(manifestError));
      });
    return () => {
      cancelled = true;
    };
  }, [presetId, presetManifestById]);

  const trimmedPrompt = value.trim();
  const trimmedName = name.trim().toLowerCase();
  const agentProfile =
    findAgentProfile(agentSettings, agentProfileId) ??
    defaultAgentProfile(agentSettings);
  const agentProfileItems: ReadonlyArray<ComboboxItem> = agentSettings.profiles.map(
    (profile) => ({
      value: profile.id,
      label: profile.label,
    }),
  );

  const presetItems: ReadonlyArray<ComboboxItem> = useMemo(
    () => [
      { value: PRESET_NONE, label: "no preset" },
      ...presetSummaries.map((summary) => ({
        value: summary.id,
        label: summary.name,
      })),
    ],
    [presetSummaries],
  );

  const activeManifest =
    presetId === PRESET_NONE ? null : presetManifestById[presetId] ?? null;
  const activeDeployManifest = useMemo(
    () => deployManifestFor(deploy),
    [deploy],
  );

  const drawerSections: CredsDrawerSection[] = useMemo(() => {
    const out: CredsDrawerSection[] = [];
    if (activeManifest) {
      out.push({
        manifest: activeManifest,
        values: presetFieldValues,
        onChange: setPresetFieldValues,
      });
    }
    if (activeDeployManifest) {
      out.push({
        manifest: activeDeployManifest,
        values: deployFieldValues,
        onChange: setDeployFieldValues,
      });
    }
    return out;
  }, [activeManifest, activeDeployManifest, presetFieldValues, deployFieldValues]);

  useEffect(() => {
    if (findAgentProfile(agentSettings, agentProfileId)) return;
    setAgentProfileId(agentSettings.defaultProfileId);
  }, [agentProfileId, agentSettings]);

  useEffect(() => {
    if (presetId !== PRESET_NONE) return;
    if (nameTouched) return;
    const url = extractGithubUrl(trimmedPrompt);
    if (url) {
      setName(suggestNameFromGithub(url));
    }
  }, [nameTouched, presetId, trimmedPrompt]);

  useEffect(() => {
    setPresetFieldValues({});
  }, [presetId]);

  useEffect(() => {
    setDeployFieldValues({});
  }, [deploy]);

  const nameValid = PROJECT_NAME_RE.test(trimmedName);
  const presetFieldsOk = activeManifest
    ? manifestFieldsValid(activeManifest, presetFieldValues)
    : true;
  const deployFieldsOk = activeDeployManifest
    ? manifestFieldsValid(activeDeployManifest, deployFieldValues)
    : true;
  const canSubmit =
    !isCreatingProject &&
    trimmedPrompt.length > 0 &&
    nameValid &&
    (presetId === PRESET_NONE || (activeManifest != null && presetFieldsOk)) &&
    deployFieldsOk;

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
    setNameTouched(true);
  };

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setError(null);
    const deployFileWrites = activeDeployManifest
      ? resolveManifest(activeDeployManifest, deployFieldValues).fileWrites
      : {};
    try {
      if (presetId !== PRESET_NONE && activeManifest) {
        await onCreateFromPreset({
          presetId,
          name: trimmedName,
          fieldValues: presetFieldValues,
          initialPrompt: trimmedPrompt,
          defaultAgentProfileId: agentProfile.id,
          defaultAgentCommand: agentProfile.command,
          additionalFileWrites: deployFileWrites,
        });
        return;
      }
      const githubRepoUrl = extractGithubUrl(trimmedPrompt);
      await onCreateProject({
        name: trimmedName,
        githubRepoUrl: githubRepoUrl ?? undefined,
        initialPrompt: trimmedPrompt,
        defaultAgentCommand: agentProfile.command,
        defaultAgentProfileId: agentProfile.id,
        designSystem,
        deploy,
        fileWrites:
          Object.keys(deployFileWrites).length > 0 ? deployFileWrites : undefined,
      });
    } catch (createError) {
      setError(toErrorMessage(createError));
    }
  }, [
    activeDeployManifest,
    activeManifest,
    agentProfile,
    canSubmit,
    deploy,
    deployFieldValues,
    designSystem,
    onCreateFromPreset,
    onCreateProject,
    presetFieldValues,
    presetId,
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

  const promptPlaceholder =
    presetId !== PRESET_NONE
      ? "describe the app to build on this preset…"
      : "describe what you want to build…";

  return (
    <section className="flex h-full min-h-0 flex-col items-center justify-center overflow-auto p-6">
      <h1
        className="mb-8 text-3xl font-medium tracking-tight text-foreground"
        style={{ fontFamily: '"Advercase", ui-serif, Georgia, Cambria, serif' }}
      >
        New Weekend{" "}
        <span className="relative inline-block">
          Project
          <img
            src="/logo-face.png"
            alt=""
            aria-hidden
            className="pointer-events-none absolute -top-3 -right-4 h-7 w-7 rotate-[35deg] object-contain drop-shadow-sm"
          />
        </span>
      </h1>
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
            placeholder={promptPlaceholder}
            value={value}
            style={{ minHeight: MIN_TEXTAREA_HEIGHT, maxHeight: MAX_TEXTAREA_HEIGHT }}
            className={cn(
              "block w-full resize-none border-0 bg-transparent px-4 py-2.5 font-code text-[13px] leading-relaxed outline-none",
              "placeholder:text-muted-foreground/40",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />

          <div className="flex items-center justify-between gap-2 border-t border-border/30 px-2 py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <Combobox
                variant="ghost"
                disabled={isCreatingProject}
                items={agentProfileItems}
                onChange={setAgentProfileId}
                value={agentProfile.id}
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
              <span className="font-code text-[11px] text-muted-foreground/30">
                ·
              </span>
              <Combobox
                variant="ghost"
                disabled={isCreatingProject}
                items={presetItems}
                onChange={(next) => setPresetId(next)}
                value={presetId}
                placeholder="preset"
                popoverWidth={260}
                className="h-7 font-code text-[11px] normal-case text-muted-foreground"
              />
              <span className="font-code text-[11px] text-muted-foreground/30">
                ·
              </span>
              <Combobox
                variant="ghost"
                disabled={isCreatingProject}
                items={DEPLOY_ITEMS}
                onChange={(next) => setDeploy(next as DeployChoice)}
                value={deploy}
                placeholder="deploy"
                popoverWidth={200}
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

        <CredsDrawer sections={drawerSections} disabled={isCreatingProject} />

        <div className="mt-2.5 flex min-h-[18px] items-center px-1">
          {error ? (
            <p className="font-code text-xs text-destructive">{error}</p>
          ) : presetLoadError ? (
            <p className="font-code text-xs text-muted-foreground/60">
              {presetLoadError}
            </p>
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

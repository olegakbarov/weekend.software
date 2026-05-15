import { Button, Seg } from "@weekend/design";
import { useEffect, useState } from "react";
import { type ShapeVariant } from "@weekend/design/registry";
import {
  THEME_NAMES,
  type ThemeName,
} from "@/components/theme/theme-provider";
import { useDesignSystem } from "@/components/theme/design-system-provider";
import { useTheme } from "@/components/theme/use-theme";
import type { DesignSystemConfigSnapshot } from "@/lib/controller";
import { H } from "../../components/heading";

const THEME_ITEMS = THEME_NAMES.map((theme) => ({
  value: theme,
  label: theme.replace("-", " "),
}));

const SHAPE_ITEMS: ReadonlyArray<{ value: ShapeVariant; label: string }> = [
  { value: "pill", label: "Pill" },
  { value: "rounded", label: "Rounded" },
];

const THEME_LABEL_ID = "docs-workbench-theme-label";
const SHAPE_LABEL_ID = "docs-workbench-shape-label";
const CSS_VARIABLES_ID = "docs-workbench-css-variables";
const THEME_VARIABLES_ID = "docs-workbench-theme-variables";

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function parseStringRecord(label: string, raw: string): Record<string, string> {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!key.startsWith("--")) {
      throw new Error(`${label} keys must be CSS variables beginning with --.`);
    }
    if (typeof value !== "string") {
      throw new Error(`${label}.${key} must be a string.`);
    }
    next[key] = value;
  }
  return next;
}

function parseThemeVariables(raw: string): Record<string, Record<string, string>> {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Per-theme variables must be a JSON object.");
  }
  const next: Record<string, Record<string, string>> = {};
  for (const [theme, value] of Object.entries(parsed)) {
    if (!THEME_NAMES.includes(theme as ThemeName)) {
      throw new Error(`${theme} is not a valid Weekend theme.`);
    }
    next[theme] = parseStringRecord(`themeVariables.${theme}`, formatJson(value));
  }
  return next;
}

export function PageWorkbench(): React.JSX.Element {
  const { activeTheme, setActiveTheme } = useTheme();
  const {
    config,
    error: designSystemError,
    isLoading,
    setConfig,
    setShape,
  } = useDesignSystem();
  const [cssVariablesDraft, setCssVariablesDraft] = useState(() =>
    formatJson(config.cssVariables)
  );
  const [themeVariablesDraft, setThemeVariablesDraft] = useState(() =>
    formatJson(config.themeVariables)
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setCssVariablesDraft(formatJson(config.cssVariables));
    setThemeVariablesDraft(formatJson(config.themeVariables));
  }, [config.cssVariables, config.themeVariables]);

  const hasDraftChanges =
    cssVariablesDraft.trim() !== formatJson(config.cssVariables) ||
    themeVariablesDraft.trim() !== formatJson(config.themeVariables);

  const handleSave = async (): Promise<void> => {
    setSaveError(null);
    setIsSaving(true);
    try {
      const next: DesignSystemConfigSnapshot = {
        ...config,
        cssVariables: parseStringRecord("CSS variables", cssVariablesDraft),
        themeVariables: parseThemeVariables(themeVariablesDraft),
      };
      await setConfig(next);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">State</div>
        <h1>Workbench</h1>
        <p className="lede">
          Edit the active Weekend design system surface and preview exported
          primitives against the same tokens used by the shell and project
          webviews.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="controls">
          Controls
        </H>
        <div className="workbench-controls">
          <div className="workbench-field" role="group" aria-labelledby={THEME_LABEL_ID}>
            <span id={THEME_LABEL_ID} className="workbench-label">
              Theme
            </span>
            <Seg
              items={THEME_ITEMS}
              onChange={(next) => setActiveTheme(next as ThemeName)}
              value={activeTheme}
            />
          </div>
          <div
            className="workbench-field workbench-field--narrow"
            role="group"
            aria-labelledby={SHAPE_LABEL_ID}
          >
            <span id={SHAPE_LABEL_ID} className="workbench-label">
              Shape
            </span>
            <Seg
              items={SHAPE_ITEMS}
              onChange={(next) => setShape(next)}
              value={config.shape}
            />
          </div>
          <div className="workbench-config-panel">
            <div className="workbench-config-header">
              <div>
                <div className="workbench-title">Global Variables</div>
                <div className="workbench-description">
                  Saved defaults propagate to tracking projects before project overrides.
                </div>
              </div>
              <Button
                disabled={!hasDraftChanges || isSaving || isLoading}
                loading={isSaving}
                onClick={() => {
                  void handleSave();
                }}
                size="sm"
                variant="secondary"
              >
                Save
              </Button>
            </div>
            <label className="workbench-field" htmlFor={CSS_VARIABLES_ID}>
              <span className="workbench-label">CSS Variables</span>
              <textarea
                id={CSS_VARIABLES_ID}
                className="workbench-textarea"
                spellCheck={false}
                value={cssVariablesDraft}
                onChange={(event) => {
                  setCssVariablesDraft(event.target.value);
                  setSaveError(null);
                }}
              />
            </label>
            <label className="workbench-field" htmlFor={THEME_VARIABLES_ID}>
              <span className="workbench-label">Per-theme Variables</span>
              <textarea
                id={THEME_VARIABLES_ID}
                className="workbench-textarea"
                spellCheck={false}
                value={themeVariablesDraft}
                onChange={(event) => {
                  setThemeVariablesDraft(event.target.value);
                  setSaveError(null);
                }}
              />
            </label>
            {saveError || designSystemError ? (
              <div className="workbench-error">{saveError ?? designSystemError}</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="primitive-preview">
          Primitive Preview
        </H>
        <div className="workbench-primitive-preview">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="tertiary">Tertiary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
      </div>
    </>
  );
}

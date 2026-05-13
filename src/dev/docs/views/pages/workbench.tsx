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
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "minmax(0, 1fr)",
            marginTop: 16,
            maxWidth: 720,
          }}
        >
          <label style={{ display: "grid", gap: 8 }}>
            <span
              style={{
                color: "var(--muted-foreground)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
              }}
            >
              Theme
            </span>
            <Seg
              items={THEME_ITEMS}
              onChange={(next) => setActiveTheme(next as ThemeName)}
              value={activeTheme}
            />
          </label>
          <label style={{ display: "grid", gap: 8, maxWidth: 360 }}>
            <span
              style={{
                color: "var(--muted-foreground)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
              }}
            >
              Shape
            </span>
            <Seg
              items={SHAPE_ITEMS}
              onChange={(next) => setShape(next)}
              value={config.shape}
            />
          </label>
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-container)",
              display: "grid",
              gap: 12,
              padding: 12,
            }}
          >
            <div
              style={{
                alignItems: "center",
                display: "flex",
                gap: 12,
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    color: "var(--foreground)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                >
                  Global Variables
                </div>
                <div
                  style={{
                    color: "var(--muted-foreground)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                  }}
                >
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
            <label style={{ display: "grid", gap: 6 }}>
              <span
                style={{
                  color: "var(--muted-foreground)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                }}
              >
                CSS Variables
              </span>
              <textarea
                spellCheck={false}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-control)",
                  color: "var(--foreground)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  lineHeight: 1.55,
                  minHeight: 150,
                  outline: "none",
                  padding: 12,
                  resize: "vertical",
                }}
                value={cssVariablesDraft}
                onChange={(event) => {
                  setCssVariablesDraft(event.target.value);
                  setSaveError(null);
                }}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span
                style={{
                  color: "var(--muted-foreground)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                }}
              >
                Per-theme Variables
              </span>
              <textarea
                spellCheck={false}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-control)",
                  color: "var(--foreground)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  lineHeight: 1.55,
                  minHeight: 150,
                  outline: "none",
                  padding: 12,
                  resize: "vertical",
                }}
                value={themeVariablesDraft}
                onChange={(event) => {
                  setThemeVariablesDraft(event.target.value);
                  setSaveError(null);
                }}
              />
            </label>
            {saveError || designSystemError ? (
              <div
                style={{
                  color: "var(--destructive)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                }}
              >
                {saveError ?? designSystemError}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="primitive-preview">
          Primitive Preview
        </H>
        <div
          style={{
            alignItems: "center",
            border: "1px solid var(--border)",
            borderRadius: "var(--shape-container, 16px)",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 16,
            padding: 16,
          }}
        >
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

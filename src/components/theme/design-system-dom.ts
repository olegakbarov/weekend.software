import type { DesignSystemConfigSnapshot, ShapeVariant } from "@/lib/controller";

export const DEFAULT_DESIGN_SYSTEM_CONFIG: DesignSystemConfigSnapshot = {
  version: 1,
  shape: "pill",
  cssVariables: {},
  themeVariables: {},
};

const STYLE_TAG_ID = "weekend-shell-ds-vars";
const THEME_SELECTORS = [
  "html:root",
  "html:root[data-theme='fluid']",
  "html:root[data-theme='fluid-dark']",
  "html:root[data-theme='weekend-dark']",
  "html:root[data-theme='weekend-paper']",
].join(",");

type ShellDesignSystemWindow = Window & {
  __WEEKEND_SHELL_DESIGN_SYSTEM__?: {
    shape: ShapeVariant;
    variables: Record<string, string>;
  };
};

function isShapeVariant(value: unknown): value is ShapeVariant {
  return value === "pill" || value === "rounded";
}

export function normalizeConfig(
  config: Partial<DesignSystemConfigSnapshot> | null | undefined
): DesignSystemConfigSnapshot {
  return {
    version: 1,
    shape: isShapeVariant(config?.shape) ? config.shape : "pill",
    cssVariables: config?.cssVariables ?? {},
    themeVariables: config?.themeVariables ?? {},
  };
}

function allowedVariableName(name: string): boolean {
  return /^--[A-Za-z0-9_-]+$/.test(name);
}

function mergeVariables(
  config: DesignSystemConfigSnapshot,
  activeTheme: string
): Record<string, string> {
  return {
    ...(config.cssVariables ?? {}),
    ...((config.themeVariables ?? {})[activeTheme] ?? {}),
  };
}

export function applyShellDesignSystem(
  config: DesignSystemConfigSnapshot,
  activeTheme: string
): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.dataset.shape = config.shape;

  const variables = mergeVariables(config, activeTheme);
  const keys = Object.keys(variables).filter(allowedVariableName);
  const win = window as ShellDesignSystemWindow;
  win.__WEEKEND_SHELL_DESIGN_SYSTEM__ = {
    shape: config.shape,
    variables,
  };

  let tag = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;
  if (keys.length === 0) {
    tag?.remove();
    window.dispatchEvent(
      new CustomEvent("weekend:design-system", {
        detail: { shape: config.shape, variables },
      })
    );
    return;
  }

  if (!tag) {
    tag = document.createElement("style");
    tag.id = STYLE_TAG_ID;
    document.head.appendChild(tag);
  }
  tag.textContent = `${THEME_SELECTORS}{}`;

  const rule = tag.sheet?.cssRules[0] as CSSStyleRule | undefined;
  const style = rule?.style;
  if (!style) return;
  for (const key of keys) {
    style.setProperty(key, String(variables[key]));
  }

  window.dispatchEvent(
    new CustomEvent("weekend:design-system", {
      detail: { shape: config.shape, variables },
    })
  );
}

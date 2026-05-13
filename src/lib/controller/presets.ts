import { invoke } from "@tauri-apps/api/core";
import type {
  CreateFromPresetInput,
  PresetField,
  PresetManifest,
  PresetSummary,
  PresetWriteTarget,
} from "./types";

type PresetDirEntry = { id: string; path: string };

export async function listPresets(): Promise<PresetSummary[]> {
  const dirs = await invoke<PresetDirEntry[]>("presets_list_dirs");
  const summaries = await Promise.all(
    dirs.map(async ({ id }) => {
      const json = await invoke<string>("presets_read_manifest", { id });
      const manifest = JSON.parse(json) as PresetManifest;
      return {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        tags: manifest.tags,
      };
    }),
  );
  return summaries;
}

export async function getPreset(id: string): Promise<PresetManifest> {
  const json = await invoke<string>("presets_read_manifest", { id });
  return JSON.parse(json) as PresetManifest;
}

export type FieldValidationError = {
  fieldKey: string;
  message: string;
};

export type ManifestResolution = {
  fileWrites: Record<string, string>;
  errors: FieldValidationError[];
  values: Record<string, string>;
};

const TEMPLATE_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

function substituteTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(TEMPLATE_PATTERN, (_match, key) => {
    if (!(key in values)) {
      throw new Error(`template references undefined field "${key}"`);
    }
    return values[key];
  });
}

function validateField(
  field: PresetField,
  value: string | undefined,
): string | null {
  const trimmed = (value ?? "").trim();
  if (field.required && !trimmed) {
    return `${field.label} is required`;
  }
  if (!trimmed) return null;
  if (field.validate?.minLength && trimmed.length < field.validate.minLength) {
    return `${field.label} must be at least ${field.validate.minLength} characters`;
  }
  if (field.validate?.pattern) {
    let regex: RegExp;
    try {
      regex = new RegExp(field.validate.pattern);
    } catch {
      return `${field.label}: manifest contains an invalid validation pattern`;
    }
    if (!regex.test(trimmed)) {
      return `${field.label} doesn't match the expected format`;
    }
  }
  return null;
}

function appendEnvLocal(
  current: string | undefined,
  key: string,
  value: string,
): string {
  const line = `${key}=${value}`;
  if (!current) return `${line}\n`;
  return current.endsWith("\n") ? `${current}${line}\n` : `${current}\n${line}\n`;
}

export function resolveManifest(
  manifest: PresetManifest,
  fieldValues: Record<string, string>,
): ManifestResolution {
  const errors: FieldValidationError[] = [];
  const values: Record<string, string> = {};

  for (const field of manifest.fields) {
    const raw = fieldValues[field.key];
    const error = validateField(field, raw);
    if (error) errors.push({ fieldKey: field.key, message: error });
    values[field.key] = (raw ?? "").trim();
  }

  if (errors.length > 0) {
    return { fileWrites: {}, errors, values };
  }

  for (const derived of manifest.derived ?? []) {
    try {
      values[derived.key] = substituteTemplate(derived.template, values);
    } catch (error) {
      errors.push({
        fieldKey: derived.key,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (errors.length > 0) {
    return { fileWrites: {}, errors, values };
  }

  const fileWrites: Record<string, string> = {};
  const allEntries: { key: string; value: string; target: PresetWriteTarget }[] = [
    ...manifest.fields.map((f) => ({
      key: f.key,
      value: values[f.key],
      target: f.writesTo,
    })),
    ...(manifest.derived ?? []).map((d) => ({
      key: d.key,
      value: values[d.key],
      target: d.writesTo,
    })),
  ];

  for (const { key, value, target } of allEntries) {
    if (target.type === "transient") continue;
    if (target.type === "env.local") {
      const envKey = target.as ?? key;
      fileWrites[".env.local"] = appendEnvLocal(
        fileWrites[".env.local"],
        envKey,
        value,
      );
      continue;
    }
    if (target.type === "config") {
      errors.push({
        fieldKey: key,
        message: `writeTarget "config" is not supported yet`,
      });
    }
  }

  if (errors.length > 0) {
    return { fileWrites: {}, errors, values };
  }

  return { fileWrites, errors: [], values };
}

export function mergeFileWrites(
  parts: Array<Record<string, string>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of parts) {
    for (const [path, content] of Object.entries(part)) {
      if (!content) continue;
      const existing = out[path];
      if (!existing) {
        out[path] = content;
        continue;
      }
      out[path] = existing.endsWith("\n")
        ? `${existing}${content}`
        : `${existing}\n${content}`;
    }
  }
  return out;
}

export async function createFromPreset(
  input: CreateFromPresetInput,
): Promise<string> {
  const manifest = await getPreset(input.presetId);
  const resolution = resolveManifest(manifest, input.fieldValues);
  if (resolution.errors.length > 0) {
    throw new Error(
      resolution.errors
        .map((error) => `${error.fieldKey}: ${error.message}`)
        .join("; "),
    );
  }
  const combined = mergeFileWrites([
    resolution.fileWrites,
    input.additionalFileWrites ?? {},
  ]);
  return invoke<string>("create_from_preset", {
    presetId: input.presetId,
    projectName: input.name,
    fileWrites: combined,
    defaultAgentProfileId: input.defaultAgentProfileId,
    defaultAgentCommand: input.defaultAgentCommand,
    initialPrompt: input.initialPrompt,
  });
}

import { type ChangeEvent, type MouseEvent, useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { resolveManifest } from "@/lib/controller/presets";
import type { PresetField, PresetManifest } from "@/lib/controller/types";
import { openExternalUrl } from "@/lib/open-url";
import { cn } from "@/lib/utils";

export type CredsDrawerSection = {
  manifest: PresetManifest;
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
};

export function CredsDrawer({
  sections,
  disabled,
}: {
  sections: CredsDrawerSection[];
  disabled: boolean;
}) {
  const rows = useMemo(
    () =>
      sections.flatMap((section) =>
        section.manifest.fields.map((field) => ({ field, section })),
      ),
    [sections],
  );

  const isOpen = rows.length > 0;

  return (
    <div
      aria-hidden={!isOpen}
      className={cn(
        "grid w-full overflow-hidden transition-[grid-template-rows,margin-top,opacity] duration-200 ease-out",
        isOpen ? "mt-2 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="min-h-0">
        <div
          className={cn(
            "overflow-hidden rounded-2xl border border-border/60",
            "bg-[var(--prompt-input-surface)]",
            "shadow-[inset_0_1px_2px_var(--prompt-input-inner-shadow)]",
          )}
        >
          {rows.map(({ field, section }, index) => (
            <CredsRow
              key={`${section.manifest.id}.${field.key}`}
              field={field}
              value={section.values[field.key] ?? ""}
              onChange={(next) =>
                section.onChange({ ...section.values, [field.key]: next })
              }
              disabled={disabled}
              showBottomBorder={index < rows.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CredsRow({
  field,
  value,
  onChange,
  disabled,
  showBottomBorder,
}: {
  field: PresetField;
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
  showBottomBorder: boolean;
}) {
  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2.5",
        showBottomBorder && "border-b border-border/30",
      )}
    >
      <input
        type={field.secret ? "password" : "text"}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        onChange={handleInput}
        placeholder={field.placeholder ?? field.label}
        value={value}
        className={cn(
          "block w-full bg-transparent font-code text-[13px] leading-tight outline-none",
          "placeholder:text-muted-foreground/35",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />
      {field.helpUrl ? (
        <a
          href={field.helpUrl}
          onClick={(event: MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            if (disabled) return;
            void openExternalUrl(field.helpUrl!);
          }}
          tabIndex={disabled ? -1 : 0}
          className={cn(
            "inline-flex shrink-0 cursor-pointer items-center gap-1 rounded font-code text-[10px] text-muted-foreground/60",
            "transition-colors hover:text-foreground",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          where to find
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      ) : null}
    </div>
  );
}

export function manifestFieldsValid(
  manifest: PresetManifest,
  values: Record<string, string>,
): boolean {
  if (manifest.fields.length === 0) return true;
  const requiredFilled = manifest.fields.every(
    (field) => !field.required || (values[field.key] ?? "").trim().length > 0,
  );
  if (!requiredFilled) return false;
  return resolveManifest(manifest, values).errors.length === 0;
}

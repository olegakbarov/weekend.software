import { useCallback, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type EnvVarsEditorProps = {
  env: Record<string, string>;
  onUpdate: (env: Record<string, string>) => Promise<void>;
  title: string;
  description: string;
};

function draftToRecord(draft: { key: string; value: string }[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const { key, value } of draft) {
    const trimmedKey = key.trim();
    if (trimmedKey) {
      result[trimmedKey] = value;
    }
  }
  return result;
}

function stableStringify(obj: Record<string, string>): string {
  const sorted = Object.keys(obj).sort();
  const entries: Record<string, string> = {};
  for (const key of sorted) {
    entries[key] = obj[key];
  }
  return JSON.stringify(entries);
}

export function EnvVarsEditor({ env, onUpdate, title, description }: EnvVarsEditorProps) {
  const [draft, setDraft] = useState<{ key: string; value: string }[]>(() =>
    Object.entries(env).map(([key, value]) => ({ key, value }))
  );
  const [isSaving, setIsSaving] = useState(false);

  const envFingerprint = stableStringify(env);
  const [lastFingerprint, setLastFingerprint] = useState(envFingerprint);
  if (envFingerprint !== lastFingerprint) {
    setLastFingerprint(envFingerprint);
    setDraft(Object.entries(env).map(([key, value]) => ({ key, value })));
  }

  const handleAdd = useCallback(() => {
    setDraft((prev) => [...prev, { key: "", value: "" }]);
  }, []);

  const handleRemove = useCallback((index: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleChange = useCallback(
    (index: number, field: "key" | "value", val: string) => {
      setDraft((prev) =>
        prev.map((entry, i) =>
          i === index ? { ...entry, [field]: val } : entry
        )
      );
    },
    []
  );

  const handleSave = useCallback(async () => {
    const result = draftToRecord(draft);
    setIsSaving(true);
    try {
      await onUpdate(result);
    } finally {
      setIsSaving(false);
    }
  }, [draft, onUpdate]);

  const hasChanges = useMemo(() => {
    return stableStringify(draftToRecord(draft)) !== stableStringify(env);
  }, [draft, env]);

  return (
    <div className="rounded border border-border/70 bg-background/60 px-3 py-2.5">
      <div className="mb-2">
        <p className="font-code text-xs text-foreground">{title}</p>
        <p className="font-code text-[11px] text-muted-foreground">{description}</p>
      </div>

      <div className="space-y-2">
        {draft.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              className="h-8 flex-1 font-code text-xs font-medium"
              placeholder="KEY"
              value={entry.key}
              onChange={(e) => handleChange(index, "key", e.target.value)}
            />
            <Input
              className="h-8 flex-[2] font-code text-xs"
              placeholder="value"
              value={entry.value}
              onChange={(e) => handleChange(index, "value", e.target.value)}
            />
            <Button
              className="h-7 px-2 text-muted-foreground hover:text-destructive"
              icon={X}
              onClick={() => handleRemove(index)}
              size="icon-sm"
              variant="ghost"
            />
          </div>
        ))}

        <div className="flex items-center gap-2">
          <Button
            className="h-7 px-2 font-code text-[10px]"
            icon={Plus}
            onClick={handleAdd}
            size="sm"
            variant="ghost"
          >
            Add Variable
          </Button>

          {hasChanges ? (
            <Button
              className="h-7 px-2 font-code text-[10px]"
              loading={isSaving}
              onClick={() => void handleSave()}
              size="sm"
              variant="ghost"
            >
              Save
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

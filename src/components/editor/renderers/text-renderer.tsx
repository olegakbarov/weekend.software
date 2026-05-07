import { CodeEditor } from "../code-editor";
import type { RendererDescriptor, RendererProps } from "./types";

function TextRendererComponent({
  filePath,
  payload,
  isVimModeEnabled = false,
  onChange,
  onSave,
  onVimModeChange,
}: RendererProps) {
  if (payload.kind !== "text") {
    throw new Error(
      `TextRenderer received non-text payload (got ${payload.kind})`,
    );
  }
  return (
    <CodeEditor
      content={payload.content}
      filePath={filePath}
      isVimModeEnabled={isVimModeEnabled}
      onChange={onChange ?? (() => {})}
      onSave={onSave ?? (() => {})}
      {...(onVimModeChange ? { onVimModeChange } : {})}
    />
  );
}

export const textRenderer: RendererDescriptor = {
  id: "text",
  name: "Text",
  payloadKind: "text",
  editable: true,
  // Catch-all — the registry asks every renderer in order, so this should be
  // last and always returns true. The dispatcher also defaults to it.
  canRender(): boolean {
    return true;
  },
  Component: TextRendererComponent,
};

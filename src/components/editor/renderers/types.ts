import type { ComponentType } from "react";
import type { VimMode } from "../code-editor";

/**
 * The payload kinds a renderer can request. The pane uses this to pick
 * the right Tauri load command (read_project_file vs read_project_file_binary)
 * before instantiating the renderer.
 */
export type RendererPayloadKind = "text" | "image";

export type TextPayload = {
  kind: "text";
  content: string;
};

export type ImagePayload = {
  kind: "image";
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
};

export type RendererPayload = TextPayload | ImagePayload;

export interface RendererProps {
  filePath: string;
  payload: RendererPayload;
  isVimModeEnabled?: boolean;
  /** Only meaningful for editable (text) renderers. */
  onChange?: (content: string) => void;
  onSave?: () => void;
  onVimModeChange?: (mode: VimMode, subMode?: string) => void;
}

export interface RendererDescriptor {
  /** Stable id for telemetry / future user-config. */
  id: string;
  /** Human label for status bars or pickers. */
  name: string;
  /** Which payload format the renderer expects. Drives load-strategy choice. */
  payloadKind: RendererPayloadKind;
  /** Which extensions this renderer claims. First match in registry wins. */
  canRender(filePath: string): boolean;
  /** Whether the renderer can edit. The pane uses this to enable/disable Save. */
  editable: boolean;
  Component: ComponentType<RendererProps>;
}

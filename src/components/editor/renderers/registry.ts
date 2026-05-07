import { imageRenderer } from "./image-renderer";
import { textRenderer } from "./text-renderer";
import type { RendererDescriptor } from "./types";

/**
 * Renderers are matched in declaration order. The text renderer is the
 * catch-all and must stay last. To add a new renderer (CSV table view, PDF
 * preview, archive browser, etc.), add it before the text renderer.
 */
const RENDERERS: ReadonlyArray<RendererDescriptor> = [
  imageRenderer,
  textRenderer,
];

export function pickRenderer(filePath: string): RendererDescriptor {
  for (const renderer of RENDERERS) {
    if (renderer.canRender(filePath)) return renderer;
  }
  return textRenderer;
}

export function listRenderers(): ReadonlyArray<RendererDescriptor> {
  return RENDERERS;
}

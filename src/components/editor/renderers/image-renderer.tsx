import type { RendererDescriptor, RendererProps } from "./types";

const IMAGE_EXTS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "ico",
  "svg",
  "avif",
]);

const NUMBER_FMT = new Intl.NumberFormat("en-US");

function ImageRendererComponent({ filePath, payload }: RendererProps) {
  if (payload.kind !== "image") {
    throw new Error(
      `ImageRenderer received non-image payload (got ${payload.kind})`,
    );
  }
  const sizeLabel = NUMBER_FMT.format(payload.sizeBytes);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border/70 px-3 py-2">
        <p
          className="truncate font-code text-xs text-muted-foreground"
          title={filePath}
        >
          {filePath} • {sizeLabel} bytes
        </p>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <img
          alt={filePath}
          className="max-h-full max-w-full rounded border border-border/60 bg-background object-contain shadow-sm"
          src={payload.dataUrl}
        />
      </div>
    </div>
  );
}

export const imageRenderer: RendererDescriptor = {
  id: "image",
  name: "Image",
  payloadKind: "image",
  editable: false,
  canRender(filePath: string): boolean {
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    return IMAGE_EXTS.has(ext);
  },
  Component: ImageRendererComponent,
};

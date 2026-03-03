/**
 * ImageDropzone - Drag-and-drop zone for image files
 */

import { AlertCircle, ImagePlus, X } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type FileRejection, useDropzone } from "react-dropzone";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "../../lib/utils";

const ACCEPTED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const ACCEPTED_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
]);

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export interface DroppedImage {
  file: File;
  preview: string; // object URL for preview
  dataBase64: string; // base64-encoded file contents
  savedFilename?: string; // task asset filename, if already saved
}

interface ImageDropzoneValueProps {
  images: DroppedImage[];
  onImagesChange: (images: DroppedImage[]) => void;
}

export interface ImageDropzoneBehaviorProps {
  disabled?: boolean;
  /** Callback that receives the open() function to programmatically trigger file picker */
  onOpenFilePicker?: (open: () => void) => void;
  /** Callback when processing state changes (for tracking async base64 conversion) */
  onProcessingChange?: ((isProcessing: boolean) => void) | undefined;
}

interface ImageDropzoneUiProps {
  className?: string;
  variant?: "standalone" | "inline";
  showOverlay?: boolean | "on-drag";
  overlayContent?: ReactNode;
  afterDropzone?: ReactNode;
  inputTestId?: string;
  /** Whether to show image previews (default true) */
  showPreviews?: boolean;
}

interface ImageDropzoneProps {
  value: ImageDropzoneValueProps;
  behavior?: ImageDropzoneBehaviorProps;
  ui?: ImageDropzoneUiProps;
  children?: ReactNode;
}

export function ImageDropzone({
  value,
  behavior,
  ui,
  children,
}: ImageDropzoneProps) {
  const { images, onImagesChange } = value;
  const {
    disabled = false,
    onOpenFilePicker,
    onProcessingChange,
  } = behavior ?? {};
  const {
    className,
    variant = "standalone",
    showOverlay = false,
    overlayContent,
    afterDropzone,
    inputTestId,
    showPreviews = true,
  } = ui ?? {};

  const [error, setError] = useState<string | null>(null);
  const processingCountRef = useRef(0);
  const isInline = variant === "inline";

  const setProcessing = useCallback(
    (delta: number) => {
      if (!onProcessingChange) return;
      processingCountRef.current = Math.max(
        0,
        processingCountRef.current + delta
      );
      onProcessingChange(processingCountRef.current > 0);
    },
    [onProcessingChange]
  );

  const processFiles = useCallback(
    async (files: File[]) => {
      setError(null);
      setProcessing(1);
      const newImages: DroppedImage[] = [];

      try {
        for (const file of files) {
          if (!isAcceptedImage(file)) {
            setError(
              `"${file.name}" is not a supported image. Use PNG, JPEG, GIF, WebP, or SVG.`
            );
            continue;
          }

          if (file.size > MAX_SIZE_BYTES) {
            setError(`"${file.name}" is too large (max 10MB).`);
            continue;
          }

          const dataBase64 = await fileToBase64(file);
          const preview = URL.createObjectURL(file);
          newImages.push({ file, preview, dataBase64 });
        }

        if (newImages.length > 0) {
          onImagesChange([...images, ...newImages]);
        }
      } finally {
        setProcessing(-1);
      }
    },
    [images, onImagesChange, setProcessing]
  );

  const handleDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      setError(null);
      if (fileRejections.length > 0) {
        const first = fileRejections[0];
        if (first) {
          const errorCode = first.errors?.[0]?.code;
          if (errorCode === "file-too-large") {
            setError(`"${first.file.name}" is too large (max 10MB).`);
          } else if (errorCode === "file-invalid-type") {
            setError(
              `"${first.file.name}" is not a supported image. Use PNG, JPEG, GIF, WebP, or SVG.`
            );
          } else {
            setError(`"${first.file.name}" could not be added.`);
          }
        }
      }
      if (acceptedFiles.length > 0) {
        processFiles(acceptedFiles);
      }
    },
    [processFiles]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (disabled) return;
      const items = e.clipboardData.items;
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file && isAcceptedImage(file)) {
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        processFiles(files);
      }
    },
    [disabled, processFiles]
  );

  const removeImage = useCallback(
    (index: number) => {
      const updated = [...images];
      const item = updated[index];
      if (item) {
        URL.revokeObjectURL(item.preview);
      }
      updated.splice(index, 1);
      onImagesChange(updated);
    },
    [images, onImagesChange]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: {
      "image/png": [],
      "image/jpeg": [],
      "image/gif": [],
      "image/webp": [],
      "image/svg+xml": [],
    },
    disabled,
    maxSize: MAX_SIZE_BYTES,
    multiple: true,
    noClick: isInline || disabled,
    onDrop: handleDrop,
  });

  const openRef = useRef(open);
  openRef.current = open;

  const stableOpen = useCallback(() => {
    openRef.current();
  }, []);

  // Expose a stable open() function to parent components via callback
  useEffect(() => {
    if (onOpenFilePicker) {
      onOpenFilePicker(stableOpen);
    }
  }, [onOpenFilePicker, stableOpen]);

  const defaultDropzoneContent = (
    <>
      <ImagePlus className="size-5 text-muted-foreground" />
      <p className="text-muted-foreground text-xs">
        Drop images here, paste, or click to browse
      </p>
    </>
  );

  const overlayMode =
    showOverlay === "on-drag" ? "on-drag" : showOverlay ? "always" : "none";
  const shouldShowOverlay =
    overlayMode === "always" || (overlayMode === "on-drag" && isDragActive);

  const inlineOverlay = shouldShowOverlay ? (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center rounded-md text-center transition-colors",
        isDragActive && "bg-primary/5",
        disabled && "opacity-60"
      )}
    >
      {overlayContent ?? defaultDropzoneContent}
    </div>
  ) : null;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Dropzone area */}
      <div
        {...getRootProps({
          className: cn(
            isInline
              ? "relative rounded-md transition-colors"
              : "relative flex flex-col items-center justify-center gap-1.5 rounded border-2 border-dashed px-4 py-3 text-center transition-colors",
            isInline
              ? isDragActive && "ring-1 ring-ring/40"
              : isDragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50",
            !isInline && disabled && "opacity-50"
          ),
          onPaste: handlePaste,
        })}
      >
        {isInline ? children : defaultDropzoneContent}
        {isInline && inlineOverlay}
        <input
          {...getInputProps({
            className: "hidden",
            "data-testid": inputTestId,
          })}
        />
      </div>

      {afterDropzone}

      {/* Error feedback */}
      {error && (
        <div className="flex items-start gap-1.5 text-destructive text-xs">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Image previews */}
      {showPreviews && images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div
              className="group relative size-16 overflow-hidden rounded border border-border"
              key={img.preview}
            >
              <img
                aria-label={img.file.name}
                className="size-full object-cover"
                height={64}
                src={img.preview}
                width={64}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="absolute top-0 right-0 rounded-bl bg-background/80 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(i);
                    }}
                    type="button"
                  >
                    <X className="size-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <span className="font-vcr text-[12px]">REMOVE IMAGE</span>
                </TooltipContent>
              </Tooltip>
              <span className="absolute right-0 bottom-0 left-0 truncate bg-background/80 px-1 text-[11px]">
                {img.file.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function isAcceptedImage(file: File) {
  if (ACCEPTED_TYPES.has(file.type)) {
    return true;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension ? ACCEPTED_EXTENSIONS.has(extension) : false;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

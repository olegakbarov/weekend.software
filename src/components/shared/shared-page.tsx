import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Check, Pencil, RefreshCw, Trash2, Upload, X } from "lucide-react";
import {
  FileTree,
  prepareFileTreeInput,
  useFileTree,
} from "@weekend/design/registry";
import { Button } from "@/components/ui/button";
import { EnvVarsEditor } from "@/components/ui/env-vars-editor";
import { Input } from "@/components/ui/input";
import {
  pickRenderer,
  type RendererPayload,
} from "@/components/editor/renderers";
import { cn } from "@/lib/utils";
import type { SharedAssetSnapshot } from "@/lib/controller";

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
};

type SharedBinaryPayload = { dataBase64: string; sizeBytes: number };

function toMimeForExt(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "n/a";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export type SharedPageProps = {
  sharedAssets: SharedAssetSnapshot[];
  sharedAssetsError: string | null;
  isLoading: boolean;
  isUploading: boolean;
  onRefresh: () => void;
  onUpload: (files: File[]) => Promise<void>;
  onRename: (fileName: string, newFileName: string) => Promise<void>;
  onDelete: (fileName: string) => Promise<void>;
  sharedEnv: Record<string, string>;
  onUpdateSharedEnv: (env: Record<string, string>) => Promise<void>;
};

function ActionBar({
  asset,
  isUploading,
  onRename,
  onDelete,
}: {
  asset: SharedAssetSnapshot;
  isUploading: boolean;
  onRename: (fileName: string, newFileName: string) => Promise<void>;
  onDelete: (fileName: string) => Promise<void>;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draft, setDraft] = useState(asset.fileName);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setIsRenaming(false);
    setDraft(asset.fileName);
    setIsDeleting(false);
  }, [asset.fileName]);

  const submitRename = () => {
    const trimmed = draft.trim();
    if (
      !trimmed ||
      trimmed === asset.fileName ||
      trimmed.includes("/") ||
      trimmed.includes("\\")
    ) {
      setIsRenaming(false);
      setDraft(asset.fileName);
      return;
    }
    void onRename(asset.fileName, trimmed).then(() => setIsRenaming(false));
  };

  const handleDelete = () => {
    if (!isDeleting) {
      setIsDeleting(true);
      return;
    }
    void onDelete(asset.fileName).then(() => setIsDeleting(false));
  };

  return (
    <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border/40 px-3">
      {isRenaming ? (
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <Input
            autoFocus
            className="h-7 flex-1 px-2 font-code text-xs"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              else if (e.key === "Escape") {
                setIsRenaming(false);
                setDraft(asset.fileName);
              }
            }}
          />
          <button
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            onClick={submitRename}
            type="button"
            title="Save"
          >
            <Check className="size-3" />
          </button>
          <button
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => {
              setIsRenaming(false);
              setDraft(asset.fileName);
            }}
            type="button"
            title="Cancel"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : (
        <p
          className="min-w-0 flex-1 truncate font-code text-xs text-muted-foreground"
          title={asset.fileName}
        >
          {asset.fileName}{" "}
          <span className="text-muted-foreground/50">
            • {formatFileSize(asset.sizeBytes)}
          </span>
        </p>
      )}
      {!isRenaming && (
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            size="xs"
            variant="ghost"
            className="font-code text-[11px]"
            disabled={isUploading}
            icon={Pencil}
            onClick={() => setIsRenaming(true)}
          >
            Rename
          </Button>
          <Button
            size="xs"
            variant={isDeleting ? "destructive" : "ghost"}
            className="font-code text-[11px]"
            disabled={isUploading}
            icon={Trash2}
            onBlur={() => setIsDeleting(false)}
            onClick={handleDelete}
          >
            {isDeleting ? "Confirm" : "Delete"}
          </Button>
        </div>
      )}
    </div>
  );
}

function PreviewBody({ fileName }: { fileName: string }) {
  const [payload, setPayload] = useState<RendererPayload | null>(null);
  const [isLoadingPayload, setIsLoadingPayload] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const renderer = pickRenderer(fileName);
    setPayload(null);
    setLoadError(null);
    setIsLoadingPayload(true);
    (async () => {
      try {
        if (renderer.payloadKind === "image") {
          const mimeType = toMimeForExt(fileName);
          const result = await invoke<SharedBinaryPayload>(
            "shared_assets_read_binary",
            { fileName },
          );
          if (cancelled) return;
          setPayload({
            kind: "image",
            mimeType,
            dataUrl: `data:${mimeType};base64,${result.dataBase64}`,
            sizeBytes: result.sizeBytes,
          });
        } else {
          const content = await invoke<string>("shared_assets_read_text", {
            fileName,
          });
          if (cancelled) return;
          setPayload({ kind: "text", content });
        }
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!cancelled) setIsLoadingPayload(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileName]);

  const renderer = pickRenderer(fileName);

  if (isLoadingPayload) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="font-code text-xs text-muted-foreground/60">Loading…</p>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <p className="font-code text-xs text-destructive">{loadError}</p>
      </div>
    );
  }
  if (!payload) return null;

  return <renderer.Component filePath={fileName} payload={payload} />;
}

export function SharedPage({
  sharedAssets,
  sharedAssetsError,
  isLoading,
  isUploading,
  onRefresh,
  onUpload,
  onRename,
  onDelete,
  sharedEnv,
  onUpdateSharedEnv,
}: SharedPageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  const paths = useMemo(
    () => sharedAssets.map((a) => a.fileName).sort(),
    [sharedAssets],
  );
  const preparedInput = useMemo(() => prepareFileTreeInput(paths), [paths]);

  const onSelectFileRef = useRef<(name: string) => void>(() => {});
  useEffect(() => {
    onSelectFileRef.current = (name: string) => setSelectedFileName(name);
  });

  const { model } = useFileTree({
    initialExpansion: "open",
    preparedInput,
    onSelectionChange: (selectedPaths) => {
      const head = selectedPaths[0];
      if (!head || head.endsWith("/")) return;
      onSelectFileRef.current(head);
    },
  });

  const initialInputRef = useRef(preparedInput);
  useEffect(() => {
    if (initialInputRef.current === preparedInput) return;
    model.resetPaths(paths, { preparedInput });
  }, [model, paths, preparedInput]);

  useEffect(() => {
    if (!selectedFileName) return;
    if (!sharedAssets.some((a) => a.fileName === selectedFileName)) {
      setSelectedFileName(null);
    }
  }, [selectedFileName, sharedAssets]);

  const selectedAsset = useMemo(
    () => sharedAssets.find((a) => a.fileName === selectedFileName) ?? null,
    [selectedFileName, sharedAssets],
  );

  const handleFiles = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    void onUpload(arr).then(() => {
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between pb-2">
        <p className="font-code text-[11px] text-muted-foreground">
          Files shared across all projects at ./shared-assets/
        </p>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 font-code text-[10px]"
            disabled={isLoading}
            icon={RefreshCw}
            loading={isLoading}
            onClick={onRefresh}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 font-code text-[10px]"
            disabled={isUploading}
            icon={Upload}
            loading={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload
          </Button>
          <input
            className="hidden"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            ref={fileInputRef}
            type="file"
          />
        </div>
      </div>

      {/* Error */}
      {sharedAssetsError && (
        <div className="rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 font-code text-[10px] text-destructive">
          {sharedAssetsError}
        </div>
      )}

      {/* Two-column file browser with drop zone */}
      <div
        className={cn(
          "mt-1 flex min-h-0 flex-1 overflow-hidden rounded border transition-colors",
          dragOver ? "border-primary/50 bg-primary/5" : "border-border/30",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        {sharedAssets.length === 0 && !isLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 py-12">
            <Upload className="size-4 text-muted-foreground/30" />
            <p className="font-code text-[11px] text-muted-foreground/50">
              No shared files yet
            </p>
            <p className="font-code text-[9px] text-muted-foreground/40">
              Drop files here or click Upload
            </p>
          </div>
        ) : (
          <>
            {/* Left column: file tree */}
            <div className="flex min-h-0 w-[280px] shrink-0 flex-col overflow-hidden border-r border-border/40">
              <div className="min-h-0 flex-1 overflow-hidden">
                <FileTree model={model} style={{ height: "100%" }} />
              </div>
              <div className="shrink-0 border-t border-border/20 px-3 py-1">
                <span className="font-code text-[9px] text-muted-foreground/50">
                  {sharedAssets.length} file{sharedAssets.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Right column: preview + actions */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {selectedAsset ? (
                <>
                  <ActionBar
                    asset={selectedAsset}
                    isUploading={isUploading}
                    onRename={onRename}
                    onDelete={onDelete}
                  />
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <PreviewBody
                      key={selectedAsset.fileName}
                      fileName={selectedAsset.fileName}
                    />
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="font-code text-[11px] text-muted-foreground/50">
                    Select a file to preview
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Shared Environment Variables */}
      <div className="mt-3 shrink-0">
        <EnvVarsEditor
          env={sharedEnv}
          onUpdate={onUpdateSharedEnv}
          title="Shared Environment Variables"
          description="Inherited by all projects. Project-level variables with the same key override these."
        />
      </div>
    </div>
  );
}

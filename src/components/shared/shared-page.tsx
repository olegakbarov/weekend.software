import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EnvVarsEditor } from "@/components/ui/env-vars-editor";
import { Input } from "@/components/ui/input";
import type { SharedAssetSnapshot } from "@/lib/controller";
import {
  Upload,
  RefreshCw,
  Pencil,
  Trash2,
  FileText,
  X,
  Check,
} from "lucide-react";

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "n/a";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatTimestamp(unixMs: number): string {
  if (!Number.isFinite(unixMs) || unixMs <= 0) return "n/a";
  try {
    return new Date(unixMs).toLocaleString();
  } catch {
    return String(unixMs);
  }
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

function AssetRow({
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
  const [draft, setDraft] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const startRename = () => {
    setIsRenaming(true);
    setDraft(asset.fileName);
  };

  const submitRename = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === asset.fileName || trimmed.includes("/") || trimmed.includes("\\")) {
      setIsRenaming(false);
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
    <div className="flex items-center gap-2 rounded border border-border/40 px-3 py-1.5 transition-colors hover:border-border/70 hover:bg-muted/20">
      <FileText className="size-3 shrink-0 text-muted-foreground/50" />

      {isRenaming ? (
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <Input
            autoFocus
            className="h-6 flex-1 px-1.5 font-code text-[10px]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              else if (e.key === "Escape") setIsRenaming(false);
            }}
          />
          <button
            className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            onClick={submitRename}
            type="button"
          >
            <Check className="size-2.5" />
          </button>
          <button
            className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setIsRenaming(false)}
            type="button"
          >
            <X className="size-2.5" />
          </button>
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          <span className="truncate font-code text-[11px] text-foreground">
            {asset.fileName}
          </span>
          <span className="ml-2 font-code text-[9px] text-muted-foreground/60">
            {formatFileSize(asset.sizeBytes)}
            {asset.modifiedAtUnixMs
              ? ` · ${formatTimestamp(asset.modifiedAtUnixMs)}`
              : ""}
          </span>
        </div>
      )}

      {!isRenaming && (
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            className="rounded p-1 text-muted-foreground/50 transition-colors hover:text-foreground"
            disabled={isUploading}
            onClick={startRename}
            title="Rename"
            type="button"
          >
            <Pencil className="size-2.5" />
          </button>
          <button
            className={`rounded p-1 transition-colors ${
              isDeleting
                ? "text-destructive hover:text-destructive"
                : "text-muted-foreground/50 hover:text-destructive"
            }`}
            disabled={isUploading}
            onClick={handleDelete}
            onBlur={() => setIsDeleting(false)}
            title={isDeleting ? "Click again to confirm" : "Delete"}
            type="button"
          >
            <Trash2 className="size-2.5" />
          </button>
        </div>
      )}
    </div>
  );
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

  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  const handleFiles = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    void onUpload(arr).then(() => {
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-2">
        <div>
          <h1 className="font-code text-xs text-foreground">Shared</h1>
          <p className="font-code text-[10px] text-muted-foreground/70">
            Files shared across all projects at ./shared-assets/
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="xs"
            variant="ghost"
            className="gap-1 font-code text-[10px]"
            disabled={isLoading}
            onClick={onRefresh}
          >
            <RefreshCw className={`size-2.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="xs"
            variant="outline"
            className="gap-1 font-code text-[10px]"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-2.5" />
            {isUploading ? "Uploading..." : "Upload"}
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
        <div className="mx-4 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 font-code text-[10px] text-destructive">
          {sharedAssetsError}
        </div>
      )}

      {/* Drop zone + file list */}
      <div
        className={`mx-4 mt-1 flex min-h-0 flex-1 flex-col overflow-hidden rounded border transition-colors ${
          dragOver
            ? "border-primary/50 bg-primary/5"
            : "border-border/30"
        }`}
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
          <div className="flex-1 overflow-auto p-2">
            <div className="flex flex-col gap-1">
              {sharedAssets.map((asset) => (
                <AssetRow
                  key={asset.fileName}
                  asset={asset}
                  isUploading={isUploading}
                  onRename={onRename}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer count */}
        {sharedAssets.length > 0 && (
          <div className="shrink-0 border-t border-border/20 px-3 py-1">
            <span className="font-code text-[9px] text-muted-foreground/50">
              {sharedAssets.length} file{sharedAssets.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Shared Environment Variables */}
      <div className="mx-4 mt-3">
        <EnvVarsEditor
          env={sharedEnv}
          onUpdate={onUpdateSharedEnv}
          title="Shared Environment Variables"
          description="Variables inherited by all projects. Project-level variables with the same key will override these."
        />
      </div>

      {/* Bottom spacer */}
      <div className="h-4 shrink-0" />
    </section>
  );
}

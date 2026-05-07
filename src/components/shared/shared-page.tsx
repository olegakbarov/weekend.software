import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileText, Pencil, RefreshCw, Trash2, Upload, X } from "lucide-react";
import {
  FileTree,
  prepareFileTreeInput,
  useFileTree,
} from "@weekend/design/registry";
import { Button } from "@/components/ui/button";
import { EnvVarsEditor } from "@/components/ui/env-vars-editor";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SharedAssetSnapshot } from "@/lib/controller";

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

function DetailsPanel({
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

  // Reset local edit state when the selected asset changes.
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
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <div className="flex items-center gap-1">
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
            <p className="break-all font-code text-sm text-foreground">
              {asset.fileName}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-code text-[11px] text-muted-foreground">
        <span>Size</span>
        <span className="text-foreground/80">{formatFileSize(asset.sizeBytes)}</span>
        <span>Modified</span>
        <span className="text-foreground/80">
          {asset.modifiedAtUnixMs ? formatTimestamp(asset.modifiedAtUnixMs) : "n/a"}
        </span>
      </div>

      {!isRenaming && (
        <div className="mt-auto flex items-center gap-1 border-t border-border/40 pt-3">
          <Button
            size="xs"
            variant="ghost"
            className="gap-1 font-code text-[11px]"
            disabled={isUploading}
            onClick={() => setIsRenaming(true)}
          >
            <Pencil className="size-2.5" /> Rename
          </Button>
          <Button
            size="xs"
            variant={isDeleting ? "destructive" : "ghost"}
            className="gap-1 font-code text-[11px]"
            disabled={isUploading}
            onBlur={() => setIsDeleting(false)}
            onClick={handleDelete}
            title={isDeleting ? "Click again to confirm" : "Delete"}
          >
            <Trash2 className="size-2.5" />
            {isDeleting ? "Confirm delete" : "Delete"}
          </Button>
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

  // Reset paths when the assets list changes.
  const initialInputRef = useRef(preparedInput);
  useEffect(() => {
    if (initialInputRef.current === preparedInput) return;
    model.resetPaths(paths, { preparedInput });
  }, [model, paths, preparedInput]);

  // Drop selection if the file goes away (e.g. after delete).
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

      {/* Two-column file browser with drop zone */}
      <div
        className={cn(
          "mx-4 mt-1 flex min-h-0 flex-1 overflow-hidden rounded border transition-colors",
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

            {/* Right column: details */}
            <div className="min-h-0 flex-1 overflow-auto">
              {selectedAsset ? (
                <DetailsPanel
                  asset={selectedAsset}
                  isUploading={isUploading}
                  onRename={onRename}
                  onDelete={onDelete}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="font-code text-[11px] text-muted-foreground/50">
                    Select a file to see details
                  </p>
                </div>
              )}
            </div>
          </>
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

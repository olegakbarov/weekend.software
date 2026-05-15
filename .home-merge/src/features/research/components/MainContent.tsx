import { useEffect, useState, useRef, useCallback } from "react";
import {
  ChevronDown,
  Folder,
  FileText,
  MoreVertical,
  Plus,
  Upload,
  Pencil,
  Trash2,
  Download,
  Image,
  File,
} from "lucide-react";
import { ScrollArea } from "~/features/research/components/ui/scroll-area";
import { Button } from "~/features/research/components/ui/button";
import { Input } from "~/features/research/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/features/research/components/ui/dropdown-menu";
import FilePreview from "~/features/research/components/FilePreview";
import * as store from "~/features/research/store";
import type { FolderNode, FileEntry } from "~/features/research/types";

interface MainContentProps {
  folderId: string;
  folderName: string;
  onOpenFolder: (id: string) => void;
  onRefresh: () => void;
}

const avatarColors = [
  "bg-violet-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-sky-600",
  "bg-fuchsia-600",
];

function getAvatarColor(email: string) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitial(email: string) {
  return email.charAt(0).toUpperCase();
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  return File;
}

export default function MainContent({
  folderId,
  folderName,
  onOpenFolder,
  onRefresh,
}: MainContentProps) {
  const [subfolders, setSubfolders] = useState<FolderNode[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [previewFile, setPreviewFile] = useState<FileEntry | null>(null);

  // Inline rename state
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // New folder creation state
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(() => {
    setSubfolders(store.getFoldersByParent(folderId));
    setFiles(store.getFilesByFolder(folderId));
  }, [folderId]);

  useEffect(() => {
    loadData();
    setEditingFolderId(null);
    setEditingFileId(null);
    setCreatingFolder(false);
    setPreviewFile(null);
  }, [folderId, loadData]);

  useEffect(() => {
    if (editingFolderId || editingFileId) {
      renameInputRef.current?.focus();
    }
  }, [editingFileId, editingFolderId]);

  useEffect(() => {
    if (creatingFolder) {
      newFolderInputRef.current?.focus();
    }
  }, [creatingFolder]);

  // --- Folder CRUD ---

  function handleCreateFolder() {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setCreatingFolder(false);
      return;
    }
    store.createFolder(trimmed, folderId);
    setCreatingFolder(false);
    setNewFolderName("");
    loadData();
    onRefresh();
  }

  function handleRenameFolder(id: string) {
    const trimmed = editName.trim();
    if (trimmed) {
      store.renameFolder(id, trimmed);
      loadData();
      onRefresh();
    }
    setEditingFolderId(null);
  }

  function handleDeleteFolder(id: string) {
    if (!confirm("Delete this folder and all its contents?")) return;
    store.deleteFolder(id);
    loadData();
    onRefresh();
  }

  // --- File CRUD ---

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList) return;

    const promises = Array.from(fileList).map(
      (file) =>
        new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            store.createFile({
              name: file.name,
              folderId,
              mimeType: file.type || "application/octet-stream",
              size: file.size,
              dataUrl: reader.result as string,
            });
            resolve();
          };
          reader.readAsDataURL(file);
        })
    );

    Promise.all(promises).then(() => {
      loadData();
      onRefresh();
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  function handleRenameFile(id: string) {
    const trimmed = editName.trim();
    if (trimmed) {
      store.renameFile(id, trimmed);
      loadData();
      onRefresh();
    }
    setEditingFileId(null);
  }

  function handleDeleteFile(id: string) {
    store.deleteFile(id);
    loadData();
    onRefresh();
  }

  function handleDownloadFile(file: FileEntry) {
    const a = document.createElement("a");
    a.href = file.dataUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const showFoldersSection = subfolders.length > 0 || creatingFolder;

  return (
    <div className="flex-1 min-h-0 bg-[#111111] p-6 overflow-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Button
          variant="ghost"
          className="text-white text-lg font-semibold px-2 hover:bg-[#1e1e1e]"
        >
          {folderName}
          <ChevronDown className="ml-1 size-4 text-neutral-400" />
        </Button>
      </div>

      {/* Folders Section */}
      {showFoldersSection && (
        <div className="mb-8">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-neutral-400">
            Folders
          </h2>
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-2">
              {subfolders.map((folder) => (
                <div
                  key={folder.id}
                  className="group relative w-[200px] shrink-0 rounded-xl border border-[#2a2a2a] bg-[#1e1e1e] p-4 text-left transition-colors hover:border-[#333] hover:bg-[#262626]"
                >
                  {/* Folder menu */}
                  <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            className="rounded p-1 text-neutral-400 hover:bg-[#333] hover:text-white"
                            onClick={(e) => e.stopPropagation()}
                            type="button"
                          />
                        }
                      >
                        <MoreVertical className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="bg-[#1e1e1e] border-[#2a2a2a]"
                      >
                        <DropdownMenuItem
                          className="cursor-pointer text-neutral-300 focus:bg-[#2a2a2a] focus:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditName(folder.name);
                            setEditingFolderId(folder.id);
                          }}
                        >
                          <Pencil className="mr-2 size-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-400 focus:text-red-300 focus:bg-[#2a2a2a] cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolder(folder.id);
                          }}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-[#2a2a2a] group-hover:bg-[#333]">
                    <Folder className="size-5 text-neutral-400" />
                  </div>

                  {editingFolderId === folder.id ? (
                    <div>
                      <Input
                        ref={renameInputRef}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => handleRenameFolder(folder.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameFolder(folder.id);
                          if (e.key === "Escape") setEditingFolderId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-7 border-[#333] bg-[#111] px-2 text-sm text-white"
                      />
                    </div>
                  ) : (
                    <button
                      className="w-full text-left"
                      onClick={() => onOpenFolder(folder.id)}
                      type="button"
                    >
                      <p className="truncate text-sm font-medium text-white">
                        {folder.name}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {store.getFileCountForFolder(folder.id)} Files
                      </p>
                    </button>
                  )}
                </div>
              ))}

              {/* Creating new folder inline */}
              {creatingFolder && (
                <div className="w-[200px] shrink-0 rounded-xl border border-[#2a2a2a] bg-[#1e1e1e] p-4">
                  <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-[#2a2a2a]">
                    <Folder className="size-5 text-neutral-400" />
                  </div>
                  <Input
                    ref={newFolderInputRef}
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onBlur={handleCreateFolder}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateFolder();
                      if (e.key === "Escape") {
                        setCreatingFolder(false);
                        setNewFolderName("");
                      }
                    }}
                    placeholder="Folder name"
                    className="h-7 border-[#333] bg-[#111] px-2 text-sm text-white"
                  />
                </div>
              )}

              {/* New folder button */}
              <button
                onClick={() => {
                  setCreatingFolder(true);
                  setNewFolderName("");
                }}
                className="flex w-[200px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#2a2a2a] p-4 text-left transition-colors hover:border-[#444] hover:bg-[#1a1a1a]"
                type="button"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-[#1e1e1e]">
                  <Plus className="size-5 text-neutral-500" />
                </div>
                <p className="text-sm text-neutral-500">New folder</p>
              </button>
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Files Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-400">
            Files
          </h2>
          <div className="flex gap-2">
            {!showFoldersSection && (
              <Button
                variant="ghost"
                size="sm"
                className="text-neutral-400 hover:bg-[#1e1e1e] hover:text-white"
                onClick={() => {
                  setCreatingFolder(true);
                  setNewFolderName("");
                }}
              >
                <Plus className="mr-1 size-4" />
                New folder
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-neutral-400 hover:bg-[#1e1e1e] hover:text-white"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-1 size-4" />
              Upload file
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            aria-label="Upload files"
            className="hidden"
            onChange={handleUpload}
          />
        </div>

        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
            <FileText className="mb-3 size-10 text-neutral-600" />
            <p className="mb-3 text-sm">No files yet</p>
            <Button
              variant="ghost"
              size="sm"
              className="text-neutral-400 hover:bg-[#1e1e1e] hover:text-white"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-1 size-4" />
              Upload a file
            </Button>
          </div>
        ) : (
          <div className="w-full">
            {/* Table Header */}
            <div className="flex items-center px-4 py-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
              <div className="flex-1">Name</div>
              <div className="w-[240px]">Added By</div>
              <div className="w-[48px]" />
            </div>

            {/* Table Rows */}
            <div>
              {files.map((file) => {
                const FileIcon = getFileIcon(file.mimeType);
                return (
                  <div
                    key={file.id}
                    className="group flex items-center border-b border-[#222] px-4 py-3 transition-colors hover:bg-[#1a1a1a]"
                  >
                    {editingFileId === file.id ? (
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <FileIcon className="size-4 shrink-0 text-neutral-500" />
                        <Input
                          ref={renameInputRef}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onBlur={() => handleRenameFile(file.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameFile(file.id);
                            if (e.key === "Escape") setEditingFileId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-7 max-w-[300px] border-[#333] bg-[#111] px-2 text-sm text-white"
                        />
                      </div>
                    ) : (
                      <button
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                        onClick={() => setPreviewFile(file)}
                        type="button"
                      >
                        <FileIcon className="size-4 shrink-0 text-neutral-500" />
                        <span className="truncate text-sm text-white">
                          {file.name}
                        </span>
                      </button>
                    )}
                    <button
                      className="flex w-[240px] cursor-pointer items-center gap-2 text-left"
                      onClick={() => {
                        if (editingFileId !== file.id) {
                          setPreviewFile(file);
                        }
                      }}
                      type="button"
                    >
                      <div
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white ${getAvatarColor(file.addedBy)}`}
                      >
                        {getInitial(file.addedBy)}
                      </div>
                      <span className="truncate text-sm text-neutral-400">
                        {file.addedBy}
                      </span>
                    </button>
                    <div className="flex w-[48px] justify-end opacity-0 transition-opacity group-hover:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button
                              className="rounded p-1 text-neutral-400 hover:bg-[#333] hover:text-white"
                              onClick={(e) => e.stopPropagation()}
                              type="button"
                            />
                          }
                        >
                          <MoreVertical className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-[#1e1e1e] border-[#2a2a2a]"
                        >
                          <DropdownMenuItem
                            className="cursor-pointer text-neutral-300 focus:bg-[#2a2a2a] focus:text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditName(file.name);
                              setEditingFileId(file.id);
                            }}
                          >
                            <Pencil className="mr-2 size-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer text-neutral-300 focus:bg-[#2a2a2a] focus:text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadFile(file);
                            }}
                          >
                            <Download className="mr-2 size-4" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-400 focus:text-red-300 focus:bg-[#2a2a2a] cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFile(file.id);
                            }}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* File Preview */}
      <FilePreview
        file={previewFile}
        open={!!previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
}

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
          <ChevronDown className="ml-1 size-4 text-gray-400" />
        </Button>
      </div>

      {/* Folders Section */}
      {showFoldersSection && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
            Folders
          </h2>
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-2">
              {subfolders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex-shrink-0 w-[200px] rounded-xl bg-[#1e1e1e] border border-[#2a2a2a] p-4 text-left transition-colors hover:bg-[#262626] hover:border-[#333] group relative"
                >
                  {/* Folder menu */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            className="p-1 rounded hover:bg-[#333] text-gray-400 hover:text-white"
                            onClick={(e) => e.stopPropagation()}
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
                          className="text-gray-300 focus:text-white focus:bg-[#2a2a2a] cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditName(folder.name);
                            setEditingFolderId(folder.id);
                            setTimeout(() => renameInputRef.current?.focus(), 0);
                          }}
                        >
                          <Pencil className="size-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-400 focus:text-red-300 focus:bg-[#2a2a2a] cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolder(folder.id);
                          }}
                        >
                          <Trash2 className="size-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <button
                    className="w-full text-left"
                    onClick={() => {
                      if (editingFolderId !== folder.id) {
                        onOpenFolder(folder.id);
                      }
                    }}
                  >
                    <div className="mb-3 flex items-center justify-center w-10 h-10 rounded-lg bg-[#2a2a2a] group-hover:bg-[#333]">
                      <Folder className="size-5 text-gray-400" />
                    </div>

                    {editingFolderId === folder.id ? (
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
                        className="h-7 text-sm bg-[#111] border-[#333] text-white px-2"
                        autoFocus
                      />
                    ) : (
                      <>
                        <p className="text-sm font-medium text-white truncate">
                          {folder.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {store.getFileCountForFolder(folder.id)} Files
                        </p>
                      </>
                    )}
                  </button>
                </div>
              ))}

              {/* Creating new folder inline */}
              {creatingFolder && (
                <div className="flex-shrink-0 w-[200px] rounded-xl bg-[#1e1e1e] border border-[#2a2a2a] p-4">
                  <div className="mb-3 flex items-center justify-center w-10 h-10 rounded-lg bg-[#2a2a2a]">
                    <Folder className="size-5 text-gray-400" />
                  </div>
                  <Input
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
                    className="h-7 text-sm bg-[#111] border-[#333] text-white px-2"
                    autoFocus
                  />
                </div>
              )}

              {/* New folder button */}
              <button
                onClick={() => {
                  setCreatingFolder(true);
                  setNewFolderName("");
                }}
                className="flex-shrink-0 w-[200px] rounded-xl border-2 border-dashed border-[#2a2a2a] p-4 text-left transition-colors hover:border-[#444] hover:bg-[#1a1a1a] flex flex-col items-center justify-center gap-2"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#1e1e1e]">
                  <Plus className="size-5 text-gray-500" />
                </div>
                <p className="text-sm text-gray-500">New folder</p>
              </button>
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Files Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Files
          </h2>
          <div className="flex gap-2">
            {!showFoldersSection && (
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white hover:bg-[#1e1e1e]"
                onClick={() => {
                  setCreatingFolder(true);
                  setNewFolderName("");
                }}
              >
                <Plus className="size-4 mr-1" />
                New folder
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white hover:bg-[#1e1e1e]"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4 mr-1" />
              Upload file
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
        </div>

        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <FileText className="size-10 mb-3 text-gray-600" />
            <p className="text-sm mb-3">No files yet</p>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white hover:bg-[#1e1e1e]"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4 mr-1" />
              Upload a file
            </Button>
          </div>
        ) : (
          <div className="w-full">
            {/* Table Header */}
            <div className="flex items-center px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                    className="flex items-center px-4 py-3 border-b border-[#222] hover:bg-[#1a1a1a] transition-colors cursor-pointer group"
                    onClick={() => {
                      if (editingFileId !== file.id) {
                        setPreviewFile(file);
                      }
                    }}
                  >
                    <div className="flex-1 flex items-center gap-3 min-w-0">
                      <FileIcon className="size-4 text-gray-500 flex-shrink-0" />
                      {editingFileId === file.id ? (
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
                          className="h-7 text-sm bg-[#111] border-[#333] text-white px-2 max-w-[300px]"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm text-white truncate">
                          {file.name}
                        </span>
                      )}
                    </div>
                    <div className="w-[240px] flex items-center gap-2">
                      <div
                        className={`size-6 rounded-full flex items-center justify-center text-xs font-medium text-white flex-shrink-0 ${getAvatarColor(file.addedBy)}`}
                      >
                        {getInitial(file.addedBy)}
                      </div>
                      <span className="text-sm text-gray-400 truncate">
                        {file.addedBy}
                      </span>
                    </div>
                    <div className="w-[48px] flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button
                              className="p-1 rounded hover:bg-[#333] text-gray-400 hover:text-white"
                              onClick={(e) => e.stopPropagation()}
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
                            className="text-gray-300 focus:text-white focus:bg-[#2a2a2a] cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditName(file.name);
                              setEditingFileId(file.id);
                              setTimeout(
                                () => renameInputRef.current?.focus(),
                                0
                              );
                            }}
                          >
                            <Pencil className="size-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-gray-300 focus:text-white focus:bg-[#2a2a2a] cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadFile(file);
                            }}
                          >
                            <Download className="size-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-400 focus:text-red-300 focus:bg-[#2a2a2a] cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFile(file.id);
                            }}
                          >
                            <Trash2 className="size-4 mr-2" />
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

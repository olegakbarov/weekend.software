import type { FolderNode, FileEntry } from "./types";

export interface FolderTreeNode {
  id: string;
  name: string;
  count: number;
  children: FolderTreeNode[];
}

const FOLDERS_KEY = "fm-folders";
const FILES_KEY = "fm-files";
const SEED_VERSION_KEY = "fm-seed-version";
const CURRENT_SEED_VERSION = "home-2";

export const ROOT_FOLDER_ID = "root";
export const SHARED_FOLDER_ID = "shared";

export const SHARED_FOLDERS: FolderNode[] = [
  { id: ROOT_FOLDER_ID, name: "Knowledge Base", parentId: null, createdAt: 0 },
  { id: SHARED_FOLDER_ID, name: "Shared Assets", parentId: ROOT_FOLDER_ID, createdAt: 0 },
  { id: "images", name: "Images", parentId: SHARED_FOLDER_ID, createdAt: 0 },
  { id: "documents", name: "Documents", parentId: SHARED_FOLDER_ID, createdAt: 0 },
  { id: "fonts", name: "Fonts", parentId: SHARED_FOLDER_ID, createdAt: 0 },
];

export const SHARED_FILES: Array<{ name: string; folderId: string }> = [
  { name: "gundam1.avif", folderId: "images" },
  { name: "gundam2.jpg", folderId: "images" },
  { name: "gundam3.webp", folderId: "images" },
  { name: "files.jpeg", folderId: "images" },
  { name: "econ_phase1_colonial.html", folderId: "documents" },
  { name: "econ_phase2_market_revolution.html", folderId: "documents" },
  { name: "econ_phase3_gilded_age.html", folderId: "documents" },
  { name: "econ_phase4_new_deal.html", folderId: "documents" },
  { name: "econ_phase5_postwar.html", folderId: "documents" },
  { name: "econ_phase6_neoliberalism.html", folderId: "documents" },
  { name: "econ_phase7_contemporary.html", folderId: "documents" },
  { name: "BerkeleyMono-Regular.otf", folderId: "fonts" },
  { name: "Inter-Bold.woff2", folderId: "fonts" },
  { name: "VCR_OSD_MONO.ttf", folderId: "fonts" },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function hasStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function mimeFromExt(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    html: "text/html",
    htm: "text/html",
    md: "text/markdown",
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
    otf: "font/otf",
    ttf: "font/ttf",
    woff2: "font/woff2",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return map[ext] ?? "application/octet-stream";
}

function ensureSeeded() {
  if (!hasStorage()) {
    return;
  }

  const now = Date.now();
  const folders = JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? "[]") as FolderNode[];
  const files = JSON.parse(localStorage.getItem(FILES_KEY) ?? "[]") as FileEntry[];
  let foldersChanged = false;
  let filesChanged = false;

  for (const sharedFolder of SHARED_FOLDERS) {
    const existing = folders.find((folder) => folder.id === sharedFolder.id);

    if (existing) {
      if (
        existing.name !== sharedFolder.name ||
        existing.parentId !== sharedFolder.parentId
      ) {
        existing.name = sharedFolder.name;
        existing.parentId = sharedFolder.parentId;
        foldersChanged = true;
      }
    } else {
      folders.push({
        ...sharedFolder,
        createdAt: now,
      });
      foldersChanged = true;
    }
  }

  for (const sharedFile of SHARED_FILES) {
    const url = `/shared-assets/${sharedFile.name}`;
    const existing = files.find(
      (file) =>
        file.url === url ||
        (file.name === sharedFile.name && file.folderId === sharedFile.folderId)
    );

    if (existing) {
      if (
        existing.folderId !== sharedFile.folderId ||
        existing.mimeType !== mimeFromExt(sharedFile.name) ||
        existing.url !== url ||
        existing.addedBy !== "shared"
      ) {
        existing.folderId = sharedFile.folderId;
        existing.mimeType = mimeFromExt(sharedFile.name);
        existing.url = url;
        existing.addedBy = "shared";
        filesChanged = true;
      }
      continue;
    }

    files.push({
      id: `shared-${sharedFile.name}`,
      name: sharedFile.name,
      folderId: sharedFile.folderId,
      mimeType: mimeFromExt(sharedFile.name),
      size: 0,
      dataUrl: "",
      url,
      addedBy: "shared",
      createdAt: now,
      updatedAt: now,
    });
    filesChanged = true;
  }

  if (foldersChanged || localStorage.getItem(FOLDERS_KEY) === null) {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  }

  if (filesChanged || localStorage.getItem(FILES_KEY) === null) {
    localStorage.setItem(FILES_KEY, JSON.stringify(files));
  }

  localStorage.setItem(SEED_VERSION_KEY, CURRENT_SEED_VERSION);
}

function loadFolders(): FolderNode[] {
  if (!hasStorage()) {
    return [];
  }
  ensureSeeded();
  const raw = localStorage.getItem(FOLDERS_KEY);
  return raw ? (JSON.parse(raw) as FolderNode[]) : [];
}

function saveFolders(folders: FolderNode[]): void {
  if (!hasStorage()) {
    return;
  }
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

function loadFiles(): FileEntry[] {
  if (!hasStorage()) {
    return [];
  }
  ensureSeeded();
  const raw = localStorage.getItem(FILES_KEY);
  return raw ? (JSON.parse(raw) as FileEntry[]) : [];
}

function saveFiles(files: FileEntry[]): void {
  if (!hasStorage()) {
    return;
  }
  localStorage.setItem(FILES_KEY, JSON.stringify(files));
}

/** Collect a folder id and all its descendant folder ids. */
function getDescendantIds(folderId: string, folders: FolderNode[]): string[] {
  const ids: string[] = [];
  const queue = [folderId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    ids.push(current);
    for (const f of folders) {
      if (f.parentId === current) {
        queue.push(f.id);
      }
    }
  }
  return ids;
}

ensureSeeded();

// ---------------------------------------------------------------------------
// Folder CRUD
// ---------------------------------------------------------------------------

export function getFoldersByParent(parentId: string): FolderNode[] {
  return loadFolders().filter((f) => f.parentId === parentId);
}

export function getFolderById(id: string): FolderNode | undefined {
  return loadFolders().find((f) => f.id === id);
}

export function getAllFolders(): FolderNode[] {
  return loadFolders();
}

export function createFolder(name: string, parentId: string): FolderNode {
  const folders = loadFolders();
  const folder: FolderNode = {
    id: crypto.randomUUID(),
    name,
    parentId,
    createdAt: Date.now(),
  };
  folders.push(folder);
  saveFolders(folders);
  return folder;
}

export function renameFolder(id: string, name: string): FolderNode | undefined {
  const folders = loadFolders();
  const folder = folders.find((f) => f.id === id);
  if (!folder) return undefined;
  folder.name = name;
  saveFolders(folders);
  return folder;
}

export function deleteFolder(id: string): boolean {
  const folders = loadFolders();
  const exists = folders.some((f) => f.id === id);
  if (!exists) return false;

  const descendantIds = getDescendantIds(id, folders);

  // Remove all descendant folders
  const remaining = folders.filter((f) => !descendantIds.includes(f.id));
  saveFolders(remaining);

  // Remove all files in those folders
  const files = loadFiles();
  const remainingFiles = files.filter((f) => !descendantIds.includes(f.folderId));
  saveFiles(remainingFiles);

  return true;
}

export function getFileCountForFolder(folderId: string): number {
  const folders = loadFolders();
  const descendantIds = getDescendantIds(folderId, folders);
  const files = loadFiles();
  return files.filter((f) => descendantIds.includes(f.folderId)).length;
}

export function buildFolderTree(parentId: string): FolderTreeNode[] {
  const folders = loadFolders();
  const files = loadFiles();

  function build(pid: string): FolderTreeNode[] {
    const children = folders.filter((f) => f.parentId === pid);
    return children.map((folder) => {
      const childNodes = build(folder.id);
      const descendantIds = getDescendantIds(folder.id, folders);
      const count = files.filter((f) => descendantIds.includes(f.folderId)).length;
      return {
        id: folder.id,
        name: folder.name,
        count,
        children: childNodes,
      };
    });
  }

  return build(parentId);
}

// ---------------------------------------------------------------------------
// File CRUD
// ---------------------------------------------------------------------------

export function getFilesByFolder(folderId: string): FileEntry[] {
  return loadFiles().filter((f) => f.folderId === folderId);
}

export function getFileById(id: string): FileEntry | undefined {
  return loadFiles().find((f) => f.id === id);
}

export function createFile(file: {
  name: string;
  folderId: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  addedBy?: string;
}): FileEntry {
  const files = loadFiles();
  const now = Date.now();
  const entry: FileEntry = {
    id: crypto.randomUUID(),
    name: file.name,
    folderId: file.folderId,
    mimeType: file.mimeType,
    size: file.size,
    dataUrl: file.dataUrl,
    addedBy: file.addedBy ?? "me@local",
    createdAt: now,
    updatedAt: now,
  };
  files.push(entry);
  saveFiles(files);
  return entry;
}

export function renameFile(id: string, name: string): FileEntry | undefined {
  const files = loadFiles();
  const file = files.find((f) => f.id === id);
  if (!file) return undefined;
  file.name = name;
  file.updatedAt = Date.now();
  saveFiles(files);
  return file;
}

export function deleteFile(id: string): boolean {
  const files = loadFiles();
  const idx = files.findIndex((f) => f.id === id);
  if (idx === -1) return false;
  files.splice(idx, 1);
  saveFiles(files);
  return true;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  folderId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}

export interface FolderTreeNode {
  id: string;
  name: string;
  count: number;
  children: FolderTreeNode[];
}

export interface FileEntry {
  id: string;
  name: string;
  folderId: string;
  mimeType: string;
  size: number;
  dataUrl: string; // base64 data URL for uploaded files
  url?: string; // served URL path for static/shared files
  addedBy: string;
  createdAt: number;
  updatedAt: number;
}

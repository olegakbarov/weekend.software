import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Input } from "~/features/research/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/features/research/components/ui/tabs";
import { ScrollArea } from "~/features/research/components/ui/scroll-area";
import { Button } from "~/features/research/components/ui/button";
import {
  Search,
  Plus,
  Copy,
  Folder,
  ChevronRight,
  ChevronDown,
  Tag,
} from "lucide-react";
import * as store from "~/features/research/store";
import type { FolderTreeNode } from "~/features/research/types";

interface SidebarProps {
  selectedFolderId: string | null;
  onSelectFolder: (id: string) => void;
  refreshKey: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  folderId: string;
}

function TreeNode({
  node,
  depth,
  selectedFolderId,
  onSelectFolder,
  expandedIds,
  onToggleExpand,
  onContextMenu,
  editingId,
  editingName,
  onEditingNameChange,
  onEditingSubmit,
  onEditingCancel,
  creatingInId,
  creatingName,
  onCreatingNameChange,
  onCreatingSubmit,
  onCreatingCancel,
}: {
  node: FolderTreeNode;
  depth: number;
  selectedFolderId: string | null;
  onSelectFolder: (id: string) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, folderId: string) => void;
  editingId: string | null;
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onEditingSubmit: () => void;
  onEditingCancel: () => void;
  creatingInId: string | null;
  creatingName: string;
  onCreatingNameChange: (name: string) => void;
  onCreatingSubmit: () => void;
  onCreatingCancel: () => void;
}) {
  const isEditing = editingId === node.id;
  const isCreatingHere = creatingInId === node.id;
  const hasChildren = node.children.length > 0 || isCreatingHere;
  const isExpanded = expandedIds.has(node.id) || isCreatingHere;
  const isSelected = selectedFolderId === node.id;

  const editInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (isCreatingHere && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [isCreatingHere]);

  return (
    <div>
      <button
        onClick={() => {
          if (isEditing) return;
          onSelectFolder(node.id);
          if (node.children.length > 0) {
            onToggleExpand(node.id);
          }
        }}
        onContextMenu={(e) => onContextMenu(e, node.id)}
        className={`
          flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm
          transition-colors duration-150
          ${isSelected ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"}
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {node.children.length > 0 ? (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
        ) : (
          <span className="h-4 w-4 shrink-0" />
        )}

        <Folder className="h-4 w-4 shrink-0 text-zinc-500" />

        {isEditing ? (
          <input
            ref={editInputRef}
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onEditingSubmit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onEditingCancel();
              }
            }}
            onBlur={onEditingCancel}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-sm text-white outline-none focus:border-white/40"
          />
        ) : (
          <span className="truncate flex-1 text-left">{node.name}</span>
        )}

        <span className="ml-auto shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-xs text-zinc-500">
          {node.count}
        </span>
      </button>

      <div
        className="overflow-hidden transition-all duration-200"
        style={{
          maxHeight: isExpanded ? `${(node.children.length + (isCreatingHere ? 1 : 0) + 1) * 200}px` : "0px",
          opacity: isExpanded ? 1 : 0,
        }}
      >
        {/* Inline create input */}
        {isCreatingHere && (
          <div
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
            style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
          >
            <span className="h-4 w-4 shrink-0" />
            <Folder className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              ref={createInputRef}
              value={creatingName}
              onChange={(e) => onCreatingNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onCreatingSubmit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  onCreatingCancel();
                }
              }}
              onBlur={onCreatingCancel}
              placeholder="New folder..."
              className="flex-1 bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-white/40"
            />
          </div>
        )}

        {node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedFolderId={selectedFolderId}
            onSelectFolder={onSelectFolder}
            expandedIds={expandedIds}
            onToggleExpand={onToggleExpand}
            onContextMenu={onContextMenu}
            editingId={editingId}
            editingName={editingName}
            onEditingNameChange={onEditingNameChange}
            onEditingSubmit={onEditingSubmit}
            onEditingCancel={onEditingCancel}
            creatingInId={creatingInId}
            creatingName={creatingName}
            onCreatingNameChange={onCreatingNameChange}
            onCreatingSubmit={onCreatingSubmit}
            onCreatingCancel={onCreatingCancel}
          />
        ))}
      </div>
    </div>
  );
}

export default function Sidebar({ selectedFolderId, onSelectFolder, refreshKey }: SidebarProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(["shared"]));
  const [searchQuery, setSearchQuery] = useState("");

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Editing (rename) state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // Creating state
  const [creatingInId, setCreatingInId] = useState<string | null>(null);
  const [creatingName, setCreatingName] = useState("");

  // For triggering internal refreshes after CRUD
  const [internalRefresh, setInternalRefresh] = useState(0);

  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Build folder tree from store
  const folderTree = useMemo(() => {
    return store.buildFolderTree("root");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, internalRefresh]);

  // Close context menu on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }
    if (contextMenu) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [contextMenu]);

  function onToggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function filterTree(nodes: FolderTreeNode[], query: string): FolderTreeNode[] {
    if (!query) return nodes;
    const lowerQuery = query.toLowerCase();
    return nodes.reduce<FolderTreeNode[]>((acc, node) => {
      const filteredChildren = filterTree(node.children, query);
      if (
        node.name.toLowerCase().includes(lowerQuery) ||
        filteredChildren.length > 0
      ) {
        acc.push({ ...node, children: filteredChildren });
      }
      return acc;
    }, []);
  }

  const visibleTree = filterTree(folderTree, searchQuery);

  // --- CRUD handlers ---

  const handleCreate = useCallback(() => {
    const parentId = selectedFolderId || "root";
    setCreatingInId(parentId);
    setCreatingName("");
    // Expand the parent so the input is visible
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(parentId);
      return next;
    });
  }, [selectedFolderId]);

  const handleCreatingSubmit = useCallback(() => {
    const name = creatingName.trim();
    if (name && creatingInId) {
      store.createFolder(name, creatingInId);
      setInternalRefresh((n) => n + 1);
    }
    setCreatingInId(null);
    setCreatingName("");
  }, [creatingName, creatingInId]);

  const handleCreatingCancel = useCallback(() => {
    setCreatingInId(null);
    setCreatingName("");
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, folderId });
  }, []);

  const handleRenameStart = useCallback(() => {
    if (!contextMenu) return;
    const folder = store.getFolderById(contextMenu.folderId);
    if (folder) {
      setEditingId(contextMenu.folderId);
      setEditingName(folder.name);
    }
    setContextMenu(null);
  }, [contextMenu]);

  const handleEditingSubmit = useCallback(() => {
    const name = editingName.trim();
    if (name && editingId) {
      store.renameFolder(editingId, name);
      setInternalRefresh((n) => n + 1);
    }
    setEditingId(null);
    setEditingName("");
  }, [editingName, editingId]);

  const handleEditingCancel = useCallback(() => {
    setEditingId(null);
    setEditingName("");
  }, []);

  const handleDelete = useCallback(() => {
    if (!contextMenu) return;
    const folderId = contextMenu.folderId;
    setContextMenu(null);

    if (folderId === "root") return;

    const folder = store.getFolderById(folderId);
    const folderName = folder?.name || "this folder";

    if (window.confirm(`Delete "${folderName}" and all its contents?`)) {
      store.deleteFolder(folderId);
      setInternalRefresh((n) => n + 1);
      if (selectedFolderId === folderId) {
        onSelectFolder("root");
      }
    }
  }, [contextMenu, selectedFolderId, onSelectFolder]);

  // When creating at root level (no matching tree node), render inline input at top
  const isCreatingAtRoot = creatingInId === "root";

  return (
    <div className="flex h-full w-80 flex-col border-r border-white/10 bg-[#1a1a1a]">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Knowledge Base</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-white/10"
            onClick={handleCreate}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-white/10"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 border-white/10 bg-white/5 pl-8 text-sm text-zinc-300 placeholder:text-zinc-600 focus-visible:ring-white/20"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="folders" className="flex flex-1 flex-col overflow-hidden">
        <div className="px-4 pb-2">
          <TabsList className="h-8 w-full bg-white/5 p-0.5">
            <TabsTrigger
              value="folders"
              className="h-7 flex-1 gap-1.5 text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=inactive]:text-zinc-500"
            >
              <Folder className="h-3.5 w-3.5" />
              Folders
            </TabsTrigger>
            <TabsTrigger
              value="tags"
              className="h-7 flex-1 gap-1.5 text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=inactive]:text-zinc-500"
            >
              <Tag className="h-3.5 w-3.5" />
              Tags
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="folders" className="mt-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="px-2 py-1">
              {/* Inline create input at root level */}
              {isCreatingAtRoot && (
                <CreateInput
                  depth={0}
                  creatingName={creatingName}
                  onCreatingNameChange={setCreatingName}
                  onCreatingSubmit={handleCreatingSubmit}
                  onCreatingCancel={handleCreatingCancel}
                />
              )}

              {visibleTree.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={onSelectFolder}
                  expandedIds={expandedIds}
                  onToggleExpand={onToggleExpand}
                  onContextMenu={handleContextMenu}
                  editingId={editingId}
                  editingName={editingName}
                  onEditingNameChange={setEditingName}
                  onEditingSubmit={handleEditingSubmit}
                  onEditingCancel={handleEditingCancel}
                  creatingInId={creatingInId}
                  creatingName={creatingName}
                  onCreatingNameChange={setCreatingName}
                  onCreatingSubmit={handleCreatingSubmit}
                  onCreatingCancel={handleCreatingCancel}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="tags" className="mt-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="px-4 py-3 text-sm text-zinc-500">
              No tags yet.
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[120px] rounded-md border border-white/10 bg-[#252525] py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="flex w-full items-center px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/10 hover:text-white"
            onClick={handleRenameStart}
          >
            Rename
          </button>
          {contextMenu.folderId !== "root" && (
            <button
              className="flex w-full items-center px-3 py-1.5 text-sm text-red-400 hover:bg-white/10 hover:text-red-300"
              onClick={handleDelete}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Standalone inline create input for root-level creation */
function CreateInput({
  depth,
  creatingName,
  onCreatingNameChange,
  onCreatingSubmit,
  onCreatingCancel,
}: {
  depth: number;
  creatingName: string;
  onCreatingNameChange: (name: string) => void;
  onCreatingSubmit: () => void;
  onCreatingCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      <span className="h-4 w-4 shrink-0" />
      <Folder className="h-4 w-4 shrink-0 text-zinc-500" />
      <input
        ref={inputRef}
        value={creatingName}
        onChange={(e) => onCreatingNameChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCreatingSubmit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCreatingCancel();
          }
        }}
        onBlur={onCreatingCancel}
        placeholder="New folder..."
        className="flex-1 bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-white/40"
      />
    </div>
  );
}

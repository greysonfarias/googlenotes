"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  FolderPlus,
  FilePlus,
  ArrowUpRight,
  FileText,
  Folder,
} from "lucide-react";
import { cn, generateId } from "@/lib/utils";
import { IndexItem, NoteRecord } from "@/types";
import { useWorkspace } from "@/lib/workspace-context";
import { useRecents } from "@/hooks/useRecents";
import { MoveToDialog } from "@/components/ui/MoveToDialog";
import { EmojiButton } from "@/components/ui/EmojiPicker";
import { db } from "@/lib/db";
import { enqueue, enqueueIndexSync } from "@/lib/sync-engine";

interface TreeItemProps {
  item: IndexItem;
  children: IndexItem[];
  depth: number;
  allItems: IndexItem[];
}

export function TreeItem({ item, children, depth, allItems }: TreeItemProps) {
  const router = useRouter();
  const { selectedNoteId, activeFolderId, setSelectedNoteId, setActiveFolderId, removeItemFromIndex, updateItemInIndex, addItemToIndex } = useWorkspace();
  const { addRecent } = useRecents();
  const [isOpen, setIsOpen] = useState(depth === 0);
  const [showMenu, setShowMenu] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(item.title);
  const renameRef = useRef<HTMLInputElement>(null);

  const isSelected =
    item.type === "note"
      ? selectedNoteId === item.id
      : activeFolderId === item.id;
  const hasChildren = children.length > 0;

  function handleClick() {
    if (item.type === "folder") {
      setIsOpen((v) => !v);
      setActiveFolderId(item.id);
      // Clear note so editor doesn't stay open when only a folder is selected
      setSelectedNoteId(null);
      router.push("/app");
    } else {
      addRecent({ id: item.id, title: item.title, icon: item.icon });
      setSelectedNoteId(item.id);
      router.push(`/app/note/${item.id}`);
    }
  }

  async function handleRename() {
    if (!renameValue.trim() || renameValue === item.title) {
      setIsRenaming(false);
      setRenameValue(item.title);
      return;
    }
    updateItemInIndex(item.id, { title: renameValue.trim() });
    setIsRenaming(false);
    await enqueue("RENAME_ITEM", item.id);
  }

  async function handleDelete() {
    setShowMenu(false);

    if (item.type === "note") {
      const driveFileId = allItems.find((i) => i.id === item.id)?.driveFileId;
      removeItemFromIndex(item.id);
      await db.notes.delete(item.id);
      if (selectedNoteId === item.id) { setSelectedNoteId(null); router.push("/app"); }
      await enqueue("DELETE_NOTE", item.id, { driveFileId });
    } else {
      removeItemFromIndex(item.id);
      await db.treeItems.where("parentId").equals(item.id).delete();
      await enqueue("DELETE_FOLDER", item.id);
      await enqueueIndexSync();
    }
  }

  async function handleMove(targetParentId: string | null) {
    updateItemInIndex(item.id, { parentId: targetParentId });
    await enqueueIndexSync();
  }

  async function handleAddNote() {
    setShowMenu(false);
    if (item.type === "folder") setIsOpen(true);

    const parentId = item.type === "folder" ? item.id : item.parentId;
    const now = new Date().toISOString();
    const noteId = generateId("note");

    // Write note to IndexedDB
    const newNote: NoteRecord = {
      id: noteId, title: "Sem título", icon: "", parentId,
      createdAt: now, updatedAt: now, blocks: [],
      syncStatus: "pending", localUpdatedAt: now,
    };
    await db.notes.put(newNote);

    // Add to tree context
    addItemToIndex({ id: noteId, type: "note", title: "Sem título", icon: "", parentId, order: Date.now(), createdAt: now, updatedAt: now });

    // Enqueue Drive sync
    await enqueue("CREATE_NOTE", noteId);

    setSelectedNoteId(noteId);
    router.push(`/app/note/${noteId}`);
  }

  async function handleIconChange(emoji: string) {
    updateItemInIndex(item.id, { icon: emoji });
    await enqueue("UPDATE_ITEM_META", item.id);
  }

  async function handleIconRemoveItem() {
    updateItemInIndex(item.id, { icon: "" });
    await enqueue("UPDATE_ITEM_META", item.id);
  }

  async function handleAddFolder() {
    setShowMenu(false);
    if (item.type === "folder") setIsOpen(true);

    const parentId = item.type === "folder" ? item.id : item.parentId;
    const now = new Date().toISOString();
    const folderId = generateId("folder");

    addItemToIndex({ id: folderId, type: "folder", title: "Nova pasta", icon: "", parentId, order: Date.now(), createdAt: now, updatedAt: now });
    await enqueue("CREATE_FOLDER", folderId);
  }

  const sortedChildren = [...children].sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.order - b.order;
  });

  return (
    <>
      {showMoveDialog && (
        <MoveToDialog
          itemId={item.id}
          items={allItems}
          onMove={handleMove}
          onClose={() => setShowMoveDialog(false)}
        />
      )}

      <div className="relative">
        {/* Indent guide lines */}
        {depth > 0 && Array.from({ length: depth }, (_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-px pointer-events-none"
            style={{
              left: `${12 + i * 16 + 8}px`,
              background: "rgba(55,53,47,0.09)",
            }}
          />
        ))}

        <div
          className={cn(
            "group relative flex items-center gap-0.5 rounded-md cursor-pointer select-none h-7",
            "hover:bg-[rgba(55,53,47,0.08)]",
            isSelected && "bg-[rgba(55,53,47,0.08)]"
          )}
          style={{ paddingLeft: `${12 + depth * 16}px`, paddingRight: "6px" }}
          onClick={handleClick}
        >
          {/* Expand arrow for folders */}
          {item.type === "folder" && (
            <span
              className={cn(
                "w-4 h-4 flex items-center justify-center text-[#999] opacity-0 group-hover:opacity-100 transition-all shrink-0",
                hasChildren && "opacity-100",
                isOpen && "rotate-90"
              )}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          )}

          {item.type === "note" && <span className="w-4 shrink-0" />}

          {/* Icon — clickable to change */}
          <span className="w-5 h-5 shrink-0 flex items-center justify-center cursor-pointer">
            <EmojiButton
              emoji={item.icon || undefined}
              onChange={handleIconChange}
              onRemove={item.icon ? handleIconRemoveItem : undefined}
              size="sm"
              defaultIcon={
                item.type === "folder" ? (
                  <Folder className="w-3.5 h-3.5 fill-[#e6a817] text-[#e6a817]" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-[#9b9a97]" />
                )
              }
            />
          </span>

          {/* Title */}
          {isRenaming ? (
            <input
              ref={renameRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") { setIsRenaming(false); setRenameValue(item.title); } }}
              className="flex-1 text-sm bg-white border border-blue-400 rounded px-1 py-0 outline-none min-w-0"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={cn(
              "flex-1 text-sm truncate",
              isSelected ? "text-[#37352f] font-medium" : "text-[#37352f]"
            )}>
              {item.title || "Sem título"}
            </span>
          )}

          {/* Actions — appear on hover */}
          <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              title="Mais opções"
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-[rgba(55,53,47,0.16)] text-[#999]"
              onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v); }}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            <button
              title="Adicionar nota"
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-[rgba(55,53,47,0.16)] text-[#999]"
              onClick={(e) => { e.stopPropagation(); handleAddNote(); }}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Context menu */}
          {showMenu && (
            <div
              className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-100 py-1 w-48"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-[#37352f] hover:bg-gray-50"
                onClick={() => { setIsRenaming(true); setShowMenu(false); setTimeout(() => renameRef.current?.select(), 50); }}
              >
                <Pencil className="w-3.5 h-3.5 text-gray-400" /> Renomear
              </button>
              <button
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-[#37352f] hover:bg-gray-50"
                onClick={() => { setShowMoveDialog(true); setShowMenu(false); }}
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-gray-400" /> Mover para...
              </button>
              {item.type === "folder" && (
                <>
                  <button
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-[#37352f] hover:bg-gray-50"
                    onClick={handleAddNote}
                  >
                    <FilePlus className="w-3.5 h-3.5 text-gray-400" /> Adicionar nota
                  </button>
                  <button
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-[#37352f] hover:bg-gray-50"
                    onClick={handleAddFolder}
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-gray-400" /> Adicionar pasta
                  </button>
                </>
              )}
              <div className="border-t border-gray-100 my-1" />
              <button
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                onClick={handleDelete}
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </button>
            </div>
          )}
        </div>

        {/* Children */}
        {item.type === "folder" && isOpen && sortedChildren.length > 0 && (
          <div>
            {sortedChildren.map((child) => (
              <TreeItem
                key={child.id}
                item={child}
                children={allItems.filter((i) => i.parentId === child.id)}
                depth={depth + 1}
                allItems={allItems}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

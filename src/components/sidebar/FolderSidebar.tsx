"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  List,
  ChevronDown,
  SlidersHorizontal,
  Plus,
  FileText,
  Folder,
  Share2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  Lock,
  PanelLeft,
} from "lucide-react";
import { cn, generateId } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace-context";
import { useRecents } from "@/hooks/useRecents";
import { EmojiButton } from "@/components/ui/EmojiPicker";
import { db } from "@/lib/db";
import { enqueue, enqueueIndexSync } from "@/lib/sync-engine";
import type { NoteRecord } from "@/types";

interface FolderSidebarProps {
  folderId: string;
  /** When true the component fills the full main content area (no note open). */
  fullscreen?: boolean;
}

function formatFullDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FolderSidebar({ folderId, fullscreen = false }: FolderSidebarProps) {
  const router = useRouter();
  const { addRecent } = useRecents();
  const {
    index,
    manifest,
    selectedNoteId,
    setSelectedNoteId,
    addItemToIndex,
    removeItemFromIndex,
    updateItemInIndex,
    sidebarVisible,
    toggleSidebar,
  } = useWorkspace();

  // ── Folder creation ──
  const [creating, setCreating] = useState(false);

  // ── Folder title editing ──
  const [titleValue, setTitleValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // ── Folder description ──
  const [description, setDescription] = useState("");
  const descRef = useRef<HTMLTextAreaElement>(null);

  // ── List item state ──
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Topbar copy state ──
  const [copied, setCopied] = useState(false);
  const [showTopbarMore, setShowTopbarMore] = useState(false);
  const topbarMoreRef = useRef<HTMLDivElement>(null);

  const folder = index?.items.find((i) => i.id === folderId);

  // Sync title when folder changes
  useEffect(() => {
    if (document.activeElement !== titleInputRef.current) {
      setTitleValue(folder?.title ?? "");
    }
  }, [folderId, folder?.title]);

  // Sync description when folder changes or index loads
  const folderDescription = index?.items.find((i) => i.id === folderId)?.description ?? "";
  useEffect(() => {
    if (document.activeElement !== descRef.current) {
      setDescription(folderDescription);
    }
  }, [folderId, folderDescription]);

  // Close context menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
      if (topbarMoreRef.current && !topbarMoreRef.current.contains(e.target as Node)) {
        setShowTopbarMore(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Folder icon handlers ──
  async function handleFolderIconChange(emoji: string) {
    updateItemInIndex(folderId, { icon: emoji });
    await enqueue("UPDATE_ITEM_META", folderId);
  }

  async function handleFolderIconRemove() {
    updateItemInIndex(folderId, { icon: "" });
    await enqueue("UPDATE_ITEM_META", folderId);
  }

  // ── Folder title handlers ──
  async function handleTitleBlur() {
    if (!folder) return;
    const next = titleValue.trim() || folder.title;
    if (next === folder.title) return;
    updateItemInIndex(folderId, { title: next });
    await enqueue("RENAME_ITEM", folderId);
  }

  // ── Description handlers ──
  function autoResizeDesc() {
    if (descRef.current) {
      descRef.current.style.height = "auto";
      descRef.current.style.height = descRef.current.scrollHeight + "px";
    }
  }

  async function handleDescriptionBlur() {
    if (!folder) return;
    const next = description.trim();
    if (next === (folder.description ?? "")) return;
    updateItemInIndex(folderId, { description: next });
    await enqueue("UPDATE_ITEM_META", folderId);
  }

  // ── New note creation ──
  async function handleNewNote() {
    if (!folder || creating) return;
    setCreating(true);

    const now = new Date().toISOString();
    const noteId = generateId("note");

    // Write to IndexedDB immediately
    const newNote: NoteRecord = {
      id: noteId,
      title: "Sem título",
      icon: "",
      parentId: folderId,
      createdAt: now,
      updatedAt: now,
      blocks: [],
      syncStatus: "pending",
      localUpdatedAt: now,
    };
    await db.notes.put(newNote);

    // Add to context tree (also writes to db.treeItems via context)
    addItemToIndex({
      id: noteId, type: "note", title: "Sem título", icon: "",
      parentId: folderId, order: Date.now(), createdAt: now, updatedAt: now,
    });

    // Enqueue Drive sync
    await enqueue("CREATE_NOTE", noteId);

    addRecent({ id: noteId, title: "Sem título", icon: "" });
    setSelectedNoteId(noteId);
    router.push(`/app/note/${noteId}`);
    setCreating(false);
  }

  // ── List item: rename ──
  async function handleRenameItem(itemId: string) {
    const trimmed = renameValue.trim();
    const original = index?.items.find((i) => i.id === itemId)?.title ?? "";
    if (!trimmed || trimmed === original) {
      setRenamingId(null);
      return;
    }
    // Update context + IndexedDB (updateItemInIndex handles both)
    updateItemInIndex(itemId, { title: trimmed });
    setRenamingId(null);
    // Enqueue rename sync
    await enqueue("RENAME_ITEM", itemId);
  }

  // ── List item: delete ──
  async function handleDeleteItem(itemId: string, itemType: "note" | "folder") {
    setMenuOpenId(null);
    const item = index?.items.find((i) => i.id === itemId);
    if (!item) return;

    if (itemType === "note") {
      // Capture driveFileId before removal (needed for sync engine DELETE)
      const driveFileId = item.driveFileId;

      // Remove locally first (optimistic)
      removeItemFromIndex(itemId);
      await db.notes.delete(itemId);
      if (selectedNoteId === itemId) { setSelectedNoteId(null); router.push("/app"); }

      // Enqueue Drive delete — pass driveFileId in payload
      await enqueue("DELETE_NOTE", itemId, { driveFileId });
    } else {
      // Remove folder and all its descendants
      removeItemFromIndex(itemId);
      await db.treeItems.where("parentId").equals(itemId).delete();
      await enqueue("DELETE_FOLDER", itemId);
      await enqueueIndexSync();
    }
  }

  // ── Topbar: share ──
  async function handleShare() {
    if (!manifest) return;
    const url = `https://drive.google.com/drive/folders/${manifest.rootFolderId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const children = (index?.items ?? [])
    .filter((i) => i.parentId === folderId)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.order - b.order;
    });

  if (!folder) return null;

  return (
    <div className={cn("flex flex-col h-full select-none", !fullscreen && "border-r border-[rgba(55,53,47,0.09)]")}>

      {/* ── Topbar — always visible, adapts to mode ── */}
      <div className="h-11 flex items-center px-3 gap-1.5 shrink-0 border-b border-[rgba(55,53,47,0.09)] bg-white">
        {/* Sidebar toggle — only in fullscreen (note topbar has it in sidebar mode) */}
        {fullscreen && (
          <button
            onClick={toggleSidebar}
            title={sidebarVisible ? "Ocultar barra lateral" : "Mostrar barra lateral"}
            className="p-1.5 rounded-md hover:bg-[rgba(55,53,47,0.08)] text-[#9b9a97] hover:text-[#37352f] transition-colors shrink-0"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}

        {/* Folder breadcrumb */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 text-sm truncate">
          <span className="shrink-0">
            {folder.icon
              ? <span className="text-sm leading-none">{folder.icon}</span>
              : <Folder className="w-3.5 h-3.5 fill-[#e6a817] text-[#e6a817]" />
            }
          </span>
          <span className="font-medium text-[#37352f] truncate">{folder.title}</span>
          <span className="text-[rgba(55,53,47,0.3)] shrink-0">·</span>
          <Lock className="w-3 h-3 text-[rgba(55,53,47,0.35)] shrink-0" />
          <span className="text-xs text-[rgba(55,53,47,0.45)] shrink-0">Privado</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {fullscreen && (
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-[rgba(55,53,47,0.16)] text-xs text-[#37352f] hover:bg-[rgba(55,53,47,0.06)] transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Share2 className="w-3 h-3" />}
              <span>{copied ? "Copiado!" : "Compartilhar"}</span>
            </button>
          )}

          <div ref={topbarMoreRef} className="relative">
            <button
              onClick={() => setShowTopbarMore((v) => !v)}
              className="p-1.5 rounded-md hover:bg-[rgba(55,53,47,0.08)] text-[#9b9a97] hover:text-[#37352f] transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showTopbarMore && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-[rgba(55,53,47,0.12)] py-1 w-44">
                <button
                  onClick={() => { titleInputRef.current?.focus(); titleInputRef.current?.select(); setShowTopbarMore(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-[#37352f] hover:bg-gray-50"
                >
                  <Pencil className="w-3.5 h-3.5 text-gray-400" /> Renomear
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Header ── compact in sidebar mode, full in fullscreen ── */}
      <div className={cn(
        "shrink-0",
        fullscreen
          ? "pt-8 pb-4 px-[10%] xl:px-[15%]"
          : "pt-5 pb-3 px-6"
      )}>
        {/* Folder icon — large in fullscreen, small in sidebar */}
        {fullscreen ? (
          <div className="mb-3 w-14 h-14">
            <EmojiButton
              emoji={folder.icon || undefined}
              onChange={handleFolderIconChange}
              onRemove={folder.icon ? handleFolderIconRemove : undefined}
              size="lg"
              defaultIcon={<Folder className="w-10 h-10 fill-[#e6a817] text-[#e6a817]" />}
            />
          </div>
        ) : (
          <div className="mb-2 w-8 h-8">
            <EmojiButton
              emoji={folder.icon || undefined}
              onChange={handleFolderIconChange}
              onRemove={folder.icon ? handleFolderIconRemove : undefined}
              size="sm"
              defaultIcon={<Folder className="w-5 h-5 fill-[#e6a817] text-[#e6a817]" />}
            />
          </div>
        )}

        {/* Editable folder title */}
        <input
          ref={titleInputRef}
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") titleInputRef.current?.blur();
            if (e.key === "Escape") { setTitleValue(folder.title); titleInputRef.current?.blur(); }
          }}
          className={cn(
            "w-full font-bold text-[#37352f] leading-tight tracking-tight bg-transparent outline-none border-none",
            fullscreen ? "text-[26px]" : "text-[20px]"
          )}
        />

        {/* Editable description */}
        <textarea
          ref={descRef}
          value={description}
          onChange={(e) => { setDescription(e.target.value); autoResizeDesc(); }}
          onBlur={handleDescriptionBlur}
          onFocus={autoResizeDesc}
          placeholder="Adicionar descrição..."
          rows={1}
          className="mt-1 w-full resize-none overflow-hidden bg-transparent text-sm text-[rgba(55,53,47,0.65)] placeholder:text-[rgba(55,53,47,0.28)] outline-none leading-relaxed"
        />
      </div>

      {/* ── Toolbar ── */}
      <div className={cn("pb-2 flex items-center gap-1", fullscreen ? "px-[10%] xl:px-[15%]" : "px-3")}>
        <button className="flex items-center gap-1.5 px-2 py-1 rounded-md text-sm text-[rgba(55,53,47,0.65)] hover:bg-[rgba(55,53,47,0.08)] transition-colors">
          <List className="w-3.5 h-3.5" />
          <span>Vista lista</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>

        <div className="flex-1" />

        <button
          title="Filtrar"
          className="p-1.5 rounded-md hover:bg-[rgba(55,53,47,0.08)] text-[#9b9a97] transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleNewNote}
          disabled={creating}
          className="flex items-center gap-1.5 ml-1 px-3 py-1.5 bg-[#2383e2] text-white rounded-md text-sm font-medium hover:bg-[#1a6fc4] transition-colors disabled:opacity-60"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo</span>
        </button>
      </div>

      {/* ── Column header ── */}
      <div className="border-y border-[rgba(55,53,47,0.09)]">
        <div className={cn("flex items-center py-1.5", fullscreen ? "px-[10%] xl:px-[15%]" : "px-5")}>
          <span className="text-[11px] font-semibold text-[#9b9a97] uppercase tracking-wider">Nome</span>
          <div className="flex-1" />
          <span className="text-[11px] font-semibold text-[#9b9a97] uppercase tracking-wider">Editado</span>
        </div>
      </div>

      {/* ── Item list ── */}
      <div className="flex-1 overflow-y-auto" ref={menuRef}>
        {children.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 px-8 text-center">
            <p className="text-sm text-[#9b9a97]">Sem páginas aqui ainda</p>
            <button onClick={handleNewNote} className="text-sm text-[#2383e2] hover:underline underline-offset-2">
              + Criar nova página
            </button>
          </div>
        ) : (
          <div>
            {children.map((item) => {
              const isSelected = item.type === "note" && selectedNoteId === item.id;
              const isMenuOpen = menuOpenId === item.id;
              const isRenaming = renamingId === item.id;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "group/row relative flex items-center gap-3 py-2.5 cursor-pointer transition-colors",
                    fullscreen ? "px-[10%] xl:px-[15%]" : "px-6 border-l-[3px]",
                    isSelected
                      ? fullscreen
                        ? "bg-[rgba(35,131,226,0.06)]"
                        : "border-[#2383e2] bg-[rgba(35,131,226,0.06)]"
                      : fullscreen
                        ? "hover:bg-[rgba(55,53,47,0.04)]"
                        : "border-transparent hover:bg-[rgba(55,53,47,0.04)]"
                  )}
                  onClick={() => {
                    if (isRenaming) return;
                    if (item.type === "note") {
                      addRecent({ id: item.id, title: item.title, icon: item.icon });
                      setSelectedNoteId(item.id);
                      router.push(`/app/note/${item.id}`);
                    }
                  }}
                >
                  {/* Item icon — clickable */}
                  <span
                    className="w-4 h-4 shrink-0 flex items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EmojiButton
                      emoji={item.icon || undefined}
                      onChange={async (emoji) => {
                        updateItemInIndex(item.id, { icon: emoji });
                        await enqueue("UPDATE_ITEM_META", item.id);
                      }}
                      onRemove={item.icon ? async () => {
                        updateItemInIndex(item.id, { icon: "" });
                        await enqueue("UPDATE_ITEM_META", item.id);
                      } : undefined}
                      size="sm"
                      defaultIcon={
                        item.type === "folder"
                          ? <Folder className="w-3.5 h-3.5 fill-[#e6a817] text-[#e6a817]" />
                          : <FileText className="w-3.5 h-3.5 text-[#9b9a97]" />
                      }
                    />
                  </span>

                  {/* Title or rename input */}
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRenameItem(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameItem(item.id);
                        if (e.key === "Escape") setRenamingId(null);
                        e.stopPropagation();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 text-sm bg-white border border-blue-400 rounded px-1 py-0 outline-none min-w-0"
                    />
                  ) : (
                    <span className={cn("text-sm truncate flex-1", isSelected ? "text-[#37352f] font-medium" : "text-[#37352f]")}>
                      {item.title || "Sem título"}
                    </span>
                  )}

                  {/* Right side: ··· button (hover) + date */}
                  <div className="flex items-center gap-2 shrink-0 ml-auto">
                    {/* ··· context menu button — visible on hover or when menu is open */}
                    <div
                      className={cn(
                        "relative transition-opacity",
                        isMenuOpen ? "opacity-100" : "opacity-0 group-hover/row:opacity-100"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => setMenuOpenId(isMenuOpen ? null : item.id)}
                        className="p-1 rounded hover:bg-[rgba(55,53,47,0.12)] text-[#9b9a97] hover:text-[#37352f] transition-colors"
                        title="Mais opções"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>

                      {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-[rgba(55,53,47,0.12)] py-1 w-44">
                          <button
                            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-[#37352f] hover:bg-gray-50"
                            onClick={() => {
                              setMenuOpenId(null);
                              setRenamingId(item.id);
                              setRenameValue(item.title);
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5 text-gray-400" /> Renomear
                          </button>
                          <div className="border-t border-gray-100 my-1" />
                          <button
                            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteItem(item.id, item.type)}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Excluir
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Date — visible when not hovering (hidden when ··· button shows) */}
                    <span
                      className={cn(
                        "text-[11px] text-[#9b9a97] transition-opacity",
                        isMenuOpen ? "opacity-0" : "opacity-100 group-hover/row:opacity-0"
                      )}
                    >
                      {item.updatedAt ? formatFullDate(item.updatedAt) : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { Clock, User } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { useRecents } from "@/hooks/useRecents";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { NoteTopbar } from "@/components/topbar/NoteTopbar";
import { EmojiButton, EmojiPicker } from "@/components/ui/EmojiPicker";
import { Note, NoteBlock, NoteRecord } from "@/types";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/sync-engine";
import { driveUploadFile, driveDeleteFile } from "@/lib/drive-client";
import { AttachmentActionsCtx, AttachmentBlockData } from "./AttachmentBlockSpec";
import { AttachmentsSection } from "@/components/note/AttachmentsSection";
import { AttachmentsPanel } from "@/components/note/AttachmentsPanel";
import { BlockEditorApi } from "./BlockEditor";
import dynamic from "next/dynamic";

const BlockEditor = dynamic(
  () => import("./BlockEditor").then((m) => m.BlockEditor),
  { ssr: false },
);

interface NoteEditorProps {
  noteId: string;
}

function formatPropDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PropRow({
  icon: Icon,
  label,
  value,
  avatar,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  avatar?: string | null;
}) {
  return (
    <div className="flex items-center py-1 px-2 -mx-2 rounded-md hover:bg-[rgba(55,53,47,0.04)] group cursor-default">
      <div className="flex items-center gap-2 w-36 shrink-0">
        <Icon className="w-3.5 h-3.5 text-[#9b9a97]" />
        <span className="text-sm text-[rgba(55,53,47,0.65)]">{label}</span>
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {avatar && (
          <img src={avatar} alt="" className="w-4 h-4 rounded-full shrink-0" />
        )}
        <span className="text-sm text-[#37352f] truncate">{value}</span>
      </div>
    </div>
  );
}

export function NoteEditor({ noteId }: NoteEditorProps) {
  const { data: session } = useSession();
  const { index, manifest, updateItemInIndex } = useWorkspace();
  const { addRecent } = useRecents();
  const { isSyncing, errors: syncErrors } = useSyncStatus();

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [localSaved, setLocalSaved] = useState(true); // saved to IndexedDB
  const [showEmptyPicker, setShowEmptyPicker] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRef = useRef<Note | null>(null);
  const emptyPickerRef = useRef<HTMLDivElement>(null);
  const editorApiRef = useRef<BlockEditorApi | null>(null);

  const noteItem = index?.items.find((i) => i.id === noteId);

  // ── saveStatus derived from sync state ─────────────────────────────────────
  const saveStatus: "saved" | "saving" | "unsaved" | "error" =
    syncErrors > 0 ? "error"
    : isSyncing ? "saving"
    : !localSaved ? "unsaved"
    : "saved";

  // ── Close empty emoji picker on outside click ──────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        emptyPickerRef.current &&
        !emptyPickerRef.current.contains(e.target as Node)
      ) {
        setShowEmptyPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Load note — IndexedDB first, fallback to Drive API ────────────────────
  useEffect(() => {
    let cancelled = false;
    if (!noteItem) return;

    async function load() {
      setLoading(true);

      // 1. Try IndexedDB first (instant)
      const cached = await db.notes.get(noteId);
      if (cached && !cancelled) {
        const { syncStatus: _s, localUpdatedAt: _l, ...noteData } = cached;
        setNote(noteData);
        noteRef.current = noteData;
        addRecent({ id: noteData.id, title: noteData.title, icon: noteData.icon });
        setLoading(false);

        // 2. Background: check if Drive has newer version
        if (noteItem?.driveFileId && cached.syncStatus === "synced") {
          try {
            const res = await fetch(
              `/api/notes/${noteId}?driveFileId=${noteItem.driveFileId}`,
            );
            if (!res.ok || cancelled) return;
            const driveNote = await res.json() as Note;

            const driveTs = new Date(driveNote.updatedAt).getTime();
            const localTs = new Date(cached.localUpdatedAt).getTime();

            if (driveTs > localTs && !cancelled) {
              // Drive is newer — update local
              const record: NoteRecord = {
                ...driveNote,
                syncStatus: "synced",
                localUpdatedAt: driveNote.updatedAt,
              };
              await db.notes.put(record);
              setNote(driveNote);
              noteRef.current = driveNote;
            }
          } catch { /* background check failed — use cached */ }
        }
        return;
      }

      // 3. Not in IndexedDB — fetch from Drive API
      if (!noteItem?.driveFileId) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/notes/${noteId}?driveFileId=${noteItem.driveFileId}`,
        );
        if (!res.ok) throw new Error("Nota não encontrada");
        const driveNote = await res.json() as Note;

        if (!cancelled) {
          // Persist to IndexedDB
          const record: NoteRecord = {
            ...driveNote,
            syncStatus: "synced",
            localUpdatedAt: driveNote.updatedAt,
          };
          await db.notes.put(record);

          setNote(driveNote);
          noteRef.current = driveNote;
          addRecent({ id: driveNote.id, title: driveNote.title, icon: driveNote.icon });
        }
      } catch {
        // leave note as null → "Nota não encontrada"
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, noteItem?.driveFileId]);

  // ── Save to IndexedDB + enqueue sync ───────────────────────────────────────
  const saveNote = useCallback(
    async (noteToSave: Note) => {
      const now = new Date().toISOString();
      const record: NoteRecord = {
        ...noteToSave,
        updatedAt: now,
        syncStatus: "pending",
        localUpdatedAt: now,
      };

      // 1. Write to IndexedDB (instant)
      await db.notes.put(record);

      // 2. Update tree item metadata locally
      await db.treeItems.update(noteToSave.id, {
        title: noteToSave.title,
        icon: noteToSave.icon,
        updatedAt: now,
        syncStatus: "pending",
        localUpdatedAt: now,
      });

      // 3. Update React context (for sidebar title / icon updates)
      updateItemInIndex(noteToSave.id, {
        title: noteToSave.title,
        icon: noteToSave.icon,
        updatedAt: now,
      });

      // 4. Enqueue for Drive sync (deduped)
      await enqueue("UPDATE_NOTE", noteToSave.id);

      setLocalSaved(true);
      // Update displayed note updatedAt
      setNote((prev) => prev ? { ...prev, updatedAt: now } : prev);
    },
    [updateItemInIndex],
  );

  const scheduleSave = useCallback(
    (updatedNote: Note) => {
      setLocalSaved(false);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => void saveNote(updatedNote), 800);
    },
    [saveNote],
  );

  function handleTitleChange(value: string) {
    if (!note) return;
    const updated = { ...note, title: value };
    setNote(updated);
    noteRef.current = updated;
    scheduleSave(updated);
  }

  function handleIconChange(emoji: string) {
    if (!note) return;
    const updated = { ...note, icon: emoji };
    setNote(updated);
    noteRef.current = updated;
    scheduleSave(updated);
  }

  function handleIconRemove() {
    if (!note) return;
    const updated = { ...note, icon: undefined };
    setNote(updated);
    noteRef.current = updated;
    scheduleSave(updated);
  }

  function handleBlocksChange(blocks: NoteBlock[]) {
    if (!note) return;
    const updated = { ...note, blocks };
    setNote(updated);
    noteRef.current = updated;
    scheduleSave(updated);
  }

  // ── Attachment: upload one or more files → insert inline blocks ──────────
  const uploadAndInsert = useCallback(
    async (files: FileList | File[]) => {
      if (!manifest || !session?.accessToken) return;
      const token = session.accessToken as string;
      setUploadingFiles(true);
      try {
        for (const file of Array.from(files)) {
          const result = await driveUploadFile(token, file, manifest.assetsFolderId);
          const data: AttachmentBlockData = {
            driveFileId: result.id,
            name:        file.name,
            mimeType:    result.mimeType || file.type || "application/octet-stream",
            size:        result.size ?? file.size,
            addedAt:     new Date().toISOString(),
          };
          editorApiRef.current?.insertAttachment(data);
        }
      } finally {
        setUploadingFiles(false);
      }
    },
    [manifest, session],
  );

  // ── Attachment: delete from Drive (block already removed by renderer) ────
  const deleteFromDrive = useCallback(
    async (driveFileId: string) => {
      if (!session?.accessToken) return;
      try {
        await driveDeleteFile(session.accessToken as string, driveFileId);
      } catch { /* ignore — file may already be gone */ }
    },
    [session],
  );

  // ── Drag & drop on the note body ─────────────────────────────────────────
  function handleBodyDragOver(e: React.DragEvent) {
    // Only intercept external file drags (not BlockNote's internal block reorder)
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.stopPropagation();
      setDraggingFiles(true);
    }
  }
  function handleBodyDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDraggingFiles(false);
    }
  }
  async function handleBodyDrop(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    setDraggingFiles(false);
    await uploadAndInsert(e.dataTransfer.files);
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-[#9b9a97] text-sm">Carregando nota...</div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-[#9b9a97] text-sm">Nota não encontrada</div>
      </div>
    );
  }

  // Derive attachment count from blocks (for topbar badge)
  const attachmentCount = note?.blocks.filter((b) => b.type === "attachment").length ?? 0;

  return (
    <AttachmentActionsCtx.Provider value={{ onDelete: deleteFromDrive }}>
    <div className="flex flex-col h-full">
      <NoteTopbar
        noteId={noteId}
        saveStatus={saveStatus}
        attachmentCount={attachmentCount}
        attachmentsOpen={attachmentsOpen}
        onToggleAttachments={() => setAttachmentsOpen((v) => !v)}
      />

      <div className="flex flex-1 min-h-0">
        {/* ── Scrollable note body — drag & drop zone ── */}
        <div
          className="flex-1 overflow-y-auto relative"
          onDragOver={handleBodyDragOver}
          onDragLeave={handleBodyDragLeave}
          onDrop={handleBodyDrop}
        >
          {/* File drag overlay */}
          {draggingFiles && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(255,255,255,0.85)] border-2 border-dashed border-[rgba(35,131,226,0.5)] rounded pointer-events-none">
              <div className="text-center">
                <p className="text-base font-medium text-[rgba(35,131,226,0.9)]">Solte para anexar</p>
                <p className="text-sm text-[rgba(35,131,226,0.6)] mt-1">O arquivo será inserido na nota</p>
              </div>
            </div>
          )}
        <div className="max-w-3xl mx-auto px-24 pt-16 pb-32">

          {/* ── Header group (hover to reveal actions) ── */}
          <div className="group/header">
            {/* Hover actions above icon */}
            <div className="flex items-center gap-2 mb-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
              <button className="flex items-center gap-1 text-xs text-[#9b9a97] hover:text-[#37352f] hover:bg-[rgba(55,53,47,0.06)] px-2 py-1 rounded transition-colors">
                <span>🖼</span>
                <span>Adicionar capa</span>
              </button>
            </div>

            {/* Icon */}
            <div className="mb-3 min-h-[3.5rem] flex items-center">
              {note.icon ? (
                <EmojiButton
                  emoji={note.icon}
                  onChange={handleIconChange}
                  onRemove={handleIconRemove}
                  size="lg"
                />
              ) : (
                <div ref={emptyPickerRef} className="relative">
                  <button
                    onClick={() => setShowEmptyPicker((v) => !v)}
                    className="opacity-0 group-hover/header:opacity-100 transition-opacity flex items-center gap-1.5 text-sm text-[#9b9a97] hover:text-[#37352f] hover:bg-[rgba(55,53,47,0.08)] px-2 py-1.5 rounded-md"
                  >
                    <span>🖼️</span>
                    <span>Adicionar ícone</span>
                  </button>
                  {showEmptyPicker && (
                    <div className="absolute left-0 top-full mt-1 z-50">
                      <EmojiPicker
                        onSelect={(emoji) => {
                          handleIconChange(emoji);
                          setShowEmptyPicker(false);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Title */}
            <input
              type="text"
              value={note.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Sem título"
              className="w-full text-[40px] font-bold text-[#37352f] outline-none border-none bg-transparent placeholder:text-[#e1e0dc] mb-4 leading-[1.2]"
            />
          </div>

          {/* ── Properties table ── */}
          <div className="mb-6 space-y-0.5">
            <PropRow
              icon={Clock}
              label="Criado em"
              value={formatPropDate(note.createdAt)}
            />
            <PropRow
              icon={Clock}
              label="Editado em"
              value={formatPropDate(note.updatedAt)}
            />
            {session?.user?.name && (
              <PropRow
                icon={User}
                label="Criado por"
                value={session.user.name}
                avatar={session.user.image}
              />
            )}
          </div>

          {/* "+ Adicionar propriedade" */}
          <button className="flex items-center gap-1.5 text-xs text-[#9b9a97] hover:text-[#37352f] mt-1 mb-1 px-2 -mx-2 py-1 rounded hover:bg-[rgba(55,53,47,0.04)] transition-colors">
            <span>+</span>
            <span>Adicionar propriedade</span>
          </button>

          {/* ── Divider ── */}
          <div className="border-t border-[rgba(55,53,47,0.09)] mt-4 mb-6" />

          {/* ── Block editor ── */}
          <BlockEditor
            key={noteId}
            blocks={note.blocks}
            onChange={handleBlocksChange}
            onEditorReady={(api) => { editorApiRef.current = api; }}
          />

          {/* ── Attachments index (bottom, always collapsed by default) ── */}
          <AttachmentsSection
            blocks={note.blocks}
            uploading={uploadingFiles}
            onAddFiles={uploadAndInsert}
          />
        </div>
      </div>

        {/* ── Attachments side panel ── */}
        {attachmentsOpen && (
          <AttachmentsPanel
            note={note}
            blocks={note.blocks}
            uploading={uploadingFiles}
            assetsFolderId={manifest?.assetsFolderId}
            onAddFiles={uploadAndInsert}
            onClose={() => setAttachmentsOpen(false)}
          />
        )}
      </div>
    </div>
    </AttachmentActionsCtx.Provider>
  );
}

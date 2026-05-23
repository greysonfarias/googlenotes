"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  ChevronDown,
  Search,
  Plus,
  Settings,
  FolderPlus,
  Loader2,
  HardDrive,
  Home,
  Clock,
  LogOut,
  Check,
  Upload,
} from "lucide-react";
import { cn, generateId } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace-context";
import { useRecents, RecentItem } from "@/hooks/useRecents";
import { TreeItem } from "./TreeItem";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/sync-engine";
import type { NoteRecord, TreeItemRecord } from "@/types";

/** Derive a stable colour from any string (for workspace avatar) */
function colorFromString(str: string): string {
  const palette = [
    "#4CAF50", "#2383e2", "#9C27B0", "#FF5722",
    "#00BCD4", "#FF9800", "#E91E63", "#607D8B",
  ];
  let hash = 0;
  for (const ch of str) hash = ((hash << 5) - hash) + ch.charCodeAt(0);
  return palette[Math.abs(hash) % palette.length];
}

export function NotesTree() {
  const router = useRouter();
  const { data: session } = useSession();
  const { manifest, index, loading, error, addItemToIndex, removeItemFromIndex, selectedNoteId, setSelectedNoteId, setActiveFolderId } =
    useWorkspace();
  const { getRecents, addRecent, subscribeToRecents } = useRecents();

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [creating, setCreating] = useState<"note" | "folder" | null>(null);
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const workspaceHeaderRef = useRef<HTMLButtonElement>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);

  // Load + subscribe to recents
  useEffect(() => {
    setRecents(getRecents());
    return subscribeToRecents(() => setRecents(getRecents()));
  }, []);

  // Close workspace menu on outside click
  useEffect(() => {
    if (!showWorkspaceMenu) return;
    function handler(e: MouseEvent) {
      if (
        workspaceMenuRef.current && !workspaceMenuRef.current.contains(e.target as Node) &&
        workspaceHeaderRef.current && !workspaceHeaderRef.current.contains(e.target as Node)
      ) {
        setShowWorkspaceMenu(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showWorkspaceMenu]);

  function openWorkspaceMenu() {
    if (workspaceHeaderRef.current) {
      const rect = workspaceHeaderRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.left });
    }
    setShowWorkspaceMenu((v) => !v);
  }

  // Resolve recents against current index (keep titles fresh, drop deleted)
  const resolvedRecents = recents
    .map((r) => {
      const live = index?.items.find((i) => i.id === r.id);
      return live ? { ...r, title: live.title, icon: live.icon } : null;
    })
    .filter(Boolean) as RecentItem[];

  const allItems = index?.items ?? [];
  const rootItems = allItems.filter((i) => i.parentId === null);

  const filteredItems = searchQuery
    ? allItems.filter((i) =>
        i.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  async function handleNewNote() {
    if (!manifest || creating) return;
    setCreating("note");

    const now = new Date().toISOString();
    const noteId = generateId("note");

    // 1. Create note in IndexedDB
    const newNote: NoteRecord = {
      id: noteId,
      title: "Sem título",
      icon: "",
      parentId: null,
      createdAt: now,
      updatedAt: now,
      blocks: [],
      syncStatus: "pending",
      localUpdatedAt: now,
    };
    await db.notes.put(newNote);

    // 2. Add to tree (context + IndexedDB via addItemToIndex)
    addItemToIndex({
      id: noteId, type: "note", title: "Sem título", icon: "",
      parentId: null, order: Date.now(), createdAt: now, updatedAt: now,
    });

    // 3. Enqueue Drive sync
    await enqueue("CREATE_NOTE", noteId);

    addRecent({ id: noteId, title: "Sem título" });
    router.push(`/app/note/${noteId}`);
    setCreating(null);
  }

  async function handleNewFolder() {
    if (!manifest || creating) return;
    setCreating("folder");

    const now = new Date().toISOString();
    const folderId = generateId("folder");

    // 1. Add to tree (context + IndexedDB)
    addItemToIndex({
      id: folderId, type: "folder", title: "Nova pasta", icon: "",
      parentId: null, order: Date.now(), createdAt: now, updatedAt: now,
    });

    // 2. Enqueue (folder creation = just update the Drive index)
    await enqueue("CREATE_FOLDER", folderId);

    setCreating(null);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-[#9b9a97]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-2 p-4 text-center">
        <HardDrive className="w-5 h-5 text-red-400" />
        <p className="text-xs text-red-500">{error}</p>
      </div>
    );
  }

  const sortedRoot = [...rootItems].sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.order - b.order;
  });

  const user = session?.user;
  const workspaceColor = colorFromString(user?.email ?? user?.name ?? "ndg");
  const initial = (user?.name ?? "N")[0].toUpperCase();

  return (
    <div className="flex flex-col h-full text-[#37352f] select-none">
      {/* ── Workspace header ── */}
      <div className="px-2 pt-2">
        <button
          ref={workspaceHeaderRef}
          onClick={openWorkspaceMenu}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[rgba(55,53,47,0.08)] cursor-pointer"
        >
          {user?.image ? (
            <img
              src={user.image}
              alt={user.name ?? ""}
              className="w-6 h-6 rounded-md shrink-0 object-cover"
            />
          ) : (
            <div
              className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center text-white text-xs font-bold"
              style={{ background: workspaceColor }}
            >
              {initial}
            </div>
          )}
          <span className="flex-1 text-sm font-semibold truncate text-left">
            Notes do Google
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-[#9b9a97] shrink-0" />
        </button>
      </div>

      {/* ── Quick nav ── */}
      <div className="px-2 mt-1 space-y-px">
        {/* Início */}
        <button
          onClick={() => { setSelectedNoteId(null); setActiveFolderId(null); router.push("/app"); }}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[rgba(55,53,47,0.08)] text-[rgba(55,53,47,0.65)] text-sm"
        >
          <Home className="w-3.5 h-3.5 shrink-0" />
          <span>Início</span>
        </button>

        {/* Buscar */}
        <button
          onClick={() => setShowSearch((v) => !v)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[rgba(55,53,47,0.08)] text-[rgba(55,53,47,0.65)] text-sm"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left">Buscar</span>
          <kbd className="text-[10px] text-[#9b9a97] bg-[rgba(55,53,47,0.08)] px-1.5 py-0.5 rounded font-sans">
            ⌘K
          </kbd>
        </button>
      </div>

      {showSearch && (
        <div className="px-3 mt-1.5">
          <input
            type="text"
            autoFocus
            placeholder="Buscar notas e pastas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onBlur={() => { if (!searchQuery) setShowSearch(false); }}
            className="w-full px-2.5 py-1.5 text-sm bg-white border border-[rgba(55,53,47,0.16)] rounded-md outline-none placeholder:text-[#9b9a97] shadow-sm"
          />
        </div>
      )}

      {/* ── Recentes ── */}
      {!searchQuery && resolvedRecents.length > 0 && (
        <div className="mt-3">
          <div className="px-3.5 pb-0.5">
            <span className="text-[11px] font-semibold text-[#9b9a97] uppercase tracking-wider">
              Recentes
            </span>
          </div>
          {resolvedRecents.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setSelectedNoteId(r.id);
                router.push(`/app/note/${r.id}`);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1 text-sm rounded-sm",
                "hover:bg-[rgba(55,53,47,0.08)]",
                selectedNoteId === r.id && "bg-[rgba(55,53,47,0.08)]"
              )}
            >
              <Clock className="w-3 h-3 shrink-0 text-[#9b9a97]" />
              <span className="truncate text-[rgba(55,53,47,0.75)]">
                {r.icon && <span className="mr-1">{r.icon}</span>}
                {r.title || "Sem título"}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Privado ── */}
      <div className="px-3.5 pt-4 pb-0.5 flex items-center">
        <span className="text-[11px] font-semibold text-[#9b9a97] uppercase tracking-wider flex-1">
          Privado
        </span>
        <button
          onClick={handleNewNote}
          disabled={creating !== null}
          title="Nova página"
          className="p-0.5 rounded hover:bg-[rgba(55,53,47,0.08)] text-[#9b9a97] hover:text-[#37352f] transition-colors disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Tree ── */}
      <div className="flex-1 overflow-y-auto pb-1">
        {filteredItems ? (
          filteredItems.length === 0 ? (
            <p className="text-xs text-[#9b9a97] text-center py-4">
              Nenhum resultado
            </p>
          ) : (
            filteredItems.map((item) => (
              <TreeItem key={item.id} item={item} children={[]} depth={0} allItems={allItems} />
            ))
          )
        ) : sortedRoot.length === 0 ? (
          <div className="px-4 py-2">
            <p className="text-xs text-[#9b9a97] leading-relaxed">
              Sem páginas ainda.{" "}
              <button onClick={handleNewNote} className="text-[#37352f] underline underline-offset-2">
                Criar primeira página
              </button>
            </p>
          </div>
        ) : (
          sortedRoot.map((item) => (
            <TreeItem
              key={item.id}
              item={item}
              children={allItems.filter((i) => i.parentId === item.id)}
              depth={0}
              allItems={allItems}
            />
          ))
        )}
      </div>

      {/* ── Bottom actions ── */}
      <div className="px-2 pb-1">
        <button
          onClick={handleNewNote}
          disabled={creating !== null}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[rgba(55,53,47,0.08)] text-[rgba(55,53,47,0.65)] text-sm disabled:opacity-50"
        >
          {creating === "note" ? (
            <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>Nova página</span>
        </button>
        <button
          onClick={handleNewFolder}
          disabled={creating !== null}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[rgba(55,53,47,0.08)] text-[rgba(55,53,47,0.65)] text-sm disabled:opacity-50"
        >
          {creating === "folder" ? (
            <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
          ) : (
            <FolderPlus className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>Nova pasta</span>
        </button>
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-[rgba(55,53,47,0.09)] px-2 py-1.5 space-y-px">
        <button
          onClick={() => router.push("/app/import")}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[rgba(55,53,47,0.08)] text-[rgba(55,53,47,0.65)] text-sm"
        >
          <Upload className="w-3.5 h-3.5 shrink-0" />
          <span>Importar do Notion</span>
        </button>
        <button
          onClick={() => router.push("/settings")}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[rgba(55,53,47,0.08)] text-[rgba(55,53,47,0.65)] text-sm"
        >
          <Settings className="w-3.5 h-3.5 shrink-0" />
          <span>Configurações</span>
        </button>
      </div>

      {/* ── Workspace dropdown (fixed, escapes overflow) ── */}
      {showWorkspaceMenu && (
        <div
          ref={workspaceMenuRef}
          style={{ position: "fixed", top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="w-72 bg-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.14)] border border-[rgba(55,53,47,0.1)] py-1 overflow-hidden"
        >
          {/* User info header */}
          {user && (
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center gap-3">
                {user.image ? (
                  <img src={user.image} alt={user.name ?? ""} className="w-10 h-10 rounded-full shrink-0 object-cover" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ background: workspaceColor }}
                  >
                    {initial}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#37352f] truncate">{user.name}</p>
                  <p className="text-xs text-[#9b9a97] truncate">{user.email}</p>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-[rgba(55,53,47,0.09)] my-1" />

          {/* Settings */}
          <button
            onClick={() => { setShowWorkspaceMenu(false); router.push("/settings"); }}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#37352f] hover:bg-[rgba(55,53,47,0.06)] transition-colors"
          >
            <Settings className="w-4 h-4 text-[#9b9a97] shrink-0" />
            <span>Configurações</span>
          </button>

          <div className="border-t border-[rgba(55,53,47,0.09)] my-1" />

          {/* Current workspace */}
          <div className="px-4 py-1.5">
            <p className="text-[11px] font-semibold text-[#9b9a97] uppercase tracking-wider mb-1">Conta</p>
            <div className="flex items-center gap-2.5 py-1.5 rounded-md">
              {user?.image ? (
                <img src={user.image} alt={user.name ?? ""} className="w-6 h-6 rounded-md shrink-0 object-cover" />
              ) : (
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: workspaceColor }}
                >
                  {initial}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#37352f] truncate">Notes do Google</p>
                <p className="text-[10px] text-[#9b9a97] truncate">{user?.email}</p>
              </div>
              <Check className="w-4 h-4 text-[#2383e2] shrink-0" />
            </div>
          </div>

          <div className="border-t border-[rgba(55,53,47,0.09)] my-1" />

          {/* Log out */}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#37352f] hover:bg-[rgba(55,53,47,0.06)] transition-colors"
          >
            <LogOut className="w-4 h-4 text-[#9b9a97] shrink-0" />
            <span>Sair de {user?.email}</span>
          </button>
        </div>
      )}
    </div>
  );
}

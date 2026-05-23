"use client";

/**
 * WorkspaceContext — IndexedDB-first implementation.
 *
 * Initialization strategy:
 *  1. Try to load manifest + tree from IndexedDB (instant).
 *  2. Always verify in background with /api/workspace/init.
 *     - If Drive has a newer manifest, update IndexedDB + React state.
 *  3. First-ever load (empty IndexedDB): block on /api/workspace/init, then persist.
 *
 * Mutations (add/remove/update items):
 *  - Update React state immediately (optimistic UI).
 *  - Write to IndexedDB (db.treeItems).
 *  - Enqueue the corresponding Sync Engine operation.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { Manifest, NoteIndex, IndexItem, TreeItemRecord } from "@/types";
import { db } from "@/lib/db";
import { enqueue, enqueueIndexSync } from "@/lib/sync-engine";

interface WorkspaceContextValue {
  manifest: Manifest | null;
  index: NoteIndex | null;
  selectedNoteId: string | null;
  activeFolderId: string | null;
  sidebarVisible: boolean;
  loading: boolean;
  error: string | null;
  setSelectedNoteId: (id: string | null) => void;
  setActiveFolderId: (id: string | null) => void;
  toggleSidebar: () => void;
  refreshIndex: () => Promise<void>;
  addItemToIndex: (item: IndexItem) => void;
  removeItemFromIndex: (id: string) => void;
  updateItemInIndex: (id: string, updates: Partial<IndexItem>) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

// ─── Helper to build NoteIndex from DB records ────────────────────────────────

function recordsToIndex(records: TreeItemRecord[]): NoteIndex {
  return {
    items: records.map(({ syncStatus: _s, localUpdatedAt: _l, ...item }) => item),
  };
}

// ─── Helper to persist a set of IndexItems to IndexedDB ──────────────────────

async function persistItems(items: IndexItem[]): Promise<void> {
  const now = new Date().toISOString();
  const records: TreeItemRecord[] = items.map((item) => ({
    ...item,
    syncStatus: "synced",
    localUpdatedAt: now,
  }));
  await db.treeItems.bulkPut(records);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [index, setIndex] = useState<NoteIndex | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("ndg-sidebar-visible") !== "false";
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const toggleSidebar = useCallback(() => {
    setSidebarVisible((v) => {
      const next = !v;
      if (typeof window !== "undefined") {
        localStorage.setItem("ndg-sidebar-visible", String(next));
      }
      return next;
    });
  }, []);

  // ── Initialization ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setLoading(true);
        setError(null);

        // 1. Try IndexedDB first
        const cached = await db.workspaces.toCollection().first();
        const cachedItems = cached ? await db.treeItems.toArray() : [];

        if (cached && cachedItems.length >= 0) {
          // Show cached data immediately
          if (!cancelled) {
            setManifest(cached.manifest);
            setIndex(recordsToIndex(cachedItems));
            setLoading(false);
          }

          // 2. Verify in background — always fetch from Drive
          const res = await fetch("/api/workspace/init");
          if (!res.ok || cancelled) return;
          const data = await res.json() as { manifest: Manifest; index: NoteIndex };

          // Update if Drive is newer
          const driveUpdatedAt = data.manifest.updatedAt;
          const localUpdatedAt = cached.manifest.updatedAt;

          if (driveUpdatedAt !== localUpdatedAt) {
            await db.workspaces.put({
              id: data.manifest.workspaceId,
              manifest: data.manifest,
              syncedAt: new Date().toISOString(),
            });
            await persistItems(data.index.items);
            if (!cancelled) {
              setManifest(data.manifest);
              setIndex(data.index);
            }
          }
        } else {
          // 3. First load — no IndexedDB data, must fetch Drive
          const res = await fetch("/api/workspace/init");
          if (!res.ok) throw new Error("Falha ao inicializar workspace");
          const data = await res.json() as { manifest: Manifest; index: NoteIndex };

          // Persist to IndexedDB
          await db.workspaces.put({
            id: data.manifest.workspaceId,
            manifest: data.manifest,
            syncedAt: new Date().toISOString(),
          });
          await persistItems(data.index.items);

          if (!cancelled) {
            setManifest(data.manifest);
            setIndex(data.index);
            setLoading(false);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro desconhecido");
          setLoading(false);
        }
      }
    }

    void init();
    return () => { cancelled = true; };
  }, []);

  // ── refreshIndex: read from IndexedDB ──────────────────────────────────────
  const refreshIndex = useCallback(async () => {
    const items = await db.treeItems.toArray();
    setIndex(recordsToIndex(items));
  }, []);

  // ── addItemToIndex ─────────────────────────────────────────────────────────
  const addItemToIndex = useCallback((item: IndexItem) => {
    // Optimistic UI
    setIndex((prev) => {
      if (!prev) return { items: [item] };
      // Replace temp item if it exists, otherwise append
      const existing = prev.items.findIndex((i) => i.id === item.id);
      if (existing !== -1) {
        const next = [...prev.items];
        next[existing] = item;
        return { items: next };
      }
      return { items: [...prev.items, item] };
    });

    // Persist to IndexedDB (fire-and-forget — optimistic already applied)
    const record: TreeItemRecord = {
      ...item,
      syncStatus: "pending",
      localUpdatedAt: new Date().toISOString(),
    };
    void db.treeItems.put(record);
  }, []);

  // ── removeItemFromIndex ────────────────────────────────────────────────────
  const removeItemFromIndex = useCallback((id: string) => {
    setIndex((prev) => {
      if (!prev) return prev;
      return {
        items: prev.items.filter(
          (i) => i.id !== id && !isDescendant(prev.items, i.id, id),
        ),
      };
    });

    // Remove from IndexedDB
    void db.treeItems.where("id").equals(id).delete();
  }, []);

  // ── updateItemInIndex ──────────────────────────────────────────────────────
  const updateItemInIndex = useCallback(
    (id: string, updates: Partial<IndexItem>) => {
      // Optimistic UI
      setIndex((prev) => {
        if (!prev) return prev;
        return {
          items: prev.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        };
      });

      // Persist to IndexedDB
      void db.treeItems.update(id, {
        ...updates,
        syncStatus: "pending",
        localUpdatedAt: new Date().toISOString(),
      });

      // Enqueue tree-index sync
      void enqueueIndexSync();
    },
    [],
  );

  return (
    <WorkspaceContext.Provider
      value={{
        manifest,
        index,
        selectedNoteId,
        activeFolderId,
        sidebarVisible,
        loading,
        error,
        setSelectedNoteId,
        setActiveFolderId,
        toggleSidebar,
        refreshIndex,
        addItemToIndex,
        removeItemFromIndex,
        updateItemInIndex,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDescendant(
  items: IndexItem[],
  itemId: string,
  ancestorId: string,
): boolean {
  const item = items.find((i) => i.id === itemId);
  if (!item || item.parentId === null) return false;
  if (item.parentId === ancestorId) return true;
  return isDescendant(items, item.parentId, ancestorId);
}

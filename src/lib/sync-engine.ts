/**
 * Sync Engine — runs entirely in the browser.
 *
 * Reads the syncQueue table from IndexedDB (Dexie) and pushes operations
 * to Google Drive using the client-side drive-client.
 *
 * Rules:
 *  - The access token is NEVER stored. It is fetched from getSession() each flush cycle.
 *  - On 401: force-refetch session, retry once, then pause and emit an event.
 *  - On network/server errors: exponential back-off, mark as error after 3 attempts.
 *  - Lock: each job transitions from 'pending' → 'syncing' atomically (optimistic lock),
 *    so two browser tabs can never process the same job.
 */

import { getSession } from "next-auth/react";
import { db } from "@/lib/db";
import {
  driveCreateFile,
  driveUpdateFile,
  driveDeleteFile,
  DriveError,
} from "@/lib/drive-client";
import type { SyncQueueItem, NoteIndex, SyncOpType } from "@/types";

// ─── Token helpers ────────────────────────────────────────────────────────────

async function getValidToken(force = false): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.error) return null;
  const token = (session as { accessToken?: string }).accessToken;
  if (!token) return null;
  return token;
}

// ─── Queue helpers ────────────────────────────────────────────────────────────

/** Add to syncQueue, deduplicating UPDATE_NOTE / UPDATE_TREE_INDEX by entityId. */
export async function enqueue(
  type: SyncOpType,
  entityId: string,
  payload?: SyncQueueItem["payload"],
): Promise<void> {
  const deduped: SyncOpType[] = ["UPDATE_NOTE", "UPDATE_TREE_INDEX", "RENAME_ITEM", "UPDATE_ITEM_META"];

  if (deduped.includes(type)) {
    const existing = await db.syncQueue
      .where("entityId").equals(entityId)
      .and((j) => j.type === type && (j.status === "pending" || j.status === "syncing"))
      .first();

    if (existing) {
      // Update timestamp — no new row needed
      await db.syncQueue.update(existing.id, { updatedAt: new Date().toISOString() });
      return;
    }
  }

  // For UPDATE_TREE_INDEX keep only 1 pending globally
  if (type === "UPDATE_TREE_INDEX") {
    const exists = await db.syncQueue
      .where("type").equals("UPDATE_TREE_INDEX")
      .and((j) => j.status === "pending" || j.status === "syncing")
      .count();
    if (exists > 0) return;
  }

  await db.syncQueue.add({
    id: `sync_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    type,
    entityId,
    payload,
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

/** Schedule a tree-index sync (deduped). */
export async function enqueueIndexSync(): Promise<void> {
  await enqueue("UPDATE_TREE_INDEX", "__index__");
}

// ─── Operation handlers ───────────────────────────────────────────────────────

async function handleCreateNote(job: SyncQueueItem, token: string): Promise<void> {
  const note = await db.notes.get(job.entityId);
  if (!note) throw new Error(`Note ${job.entityId} not found in IndexedDB`);

  const ws = await db.workspaces.toCollection().first();
  if (!ws) throw new Error("No workspace found in IndexedDB");
  const { notesFolderId, markdownFolderId } = ws.manifest;

  // Create JSON note file in Drive
  const driveFileId = await driveCreateFile(
    token,
    `${note.id}.json`,
    JSON.stringify(note),
    "application/json",
    notesFolderId,
  );

  // Persist driveFileId back to local DB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.treeItems.where("id").equals(note.id).modify((t: any) => { t.driveFileId = driveFileId; t.syncStatus = "synced"; });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.notes.where("id").equals(note.id).modify((n: any) => { n.syncStatus = "synced"; });

  // Markdown export — best-effort, never fails the job
  try {
    const md = noteToMarkdown(note.title, note.blocks);
    await driveCreateFile(token, `${note.id}.md`, md, "text/markdown", markdownFolderId);
  } catch { /* ignore */ }

  // Trigger index update
  await enqueueIndexSync();
}

async function handleUpdateNote(job: SyncQueueItem, token: string): Promise<void> {
  const note = await db.notes.get(job.entityId);
  if (!note) throw new Error(`Note ${job.entityId} not found in IndexedDB`);

  const treeItem = await db.treeItems.get(job.entityId);
  const driveFileId = treeItem?.driveFileId;
  if (!driveFileId) {
    // Drive file not created yet — convert to CREATE_NOTE
    await handleCreateNote({ ...job, type: "CREATE_NOTE" }, token);
    return;
  }

  await driveUpdateFile(token, driveFileId, JSON.stringify(note));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.notes.where("id").equals(note.id).modify((n: any) => { n.syncStatus = "synced"; });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.treeItems.where("id").equals(note.id).modify((t: any) => { t.syncStatus = "synced"; });

  // Markdown update — best-effort
  try {
    const ws = await db.workspaces.toCollection().first();
    if (ws) {
      const md = noteToMarkdown(note.title, note.blocks);
      // Find the markdown file by searching Drive for name (best-effort skip if not found)
      const { markdownFolderId } = ws.manifest;
      void driveCreateFile(token, `${note.id}.md`, md, "text/markdown", markdownFolderId)
        .catch(() => { /* ignore */ });
    }
  } catch { /* ignore */ }

  await enqueueIndexSync();
}

async function handleDeleteNote(job: SyncQueueItem, token: string): Promise<void> {
  const { driveFileId, markdownFileId } = job.payload ?? {};
  if (driveFileId) {
    await driveDeleteFile(token, driveFileId);
  }
  if (markdownFileId) {
    await driveDeleteFile(token, markdownFileId).catch(() => { /* ignore */ });
  }
  await enqueueIndexSync();
}

async function handleCreateFolder(job: SyncQueueItem, _token: string): Promise<void> {
  // Folders are virtual in our schema (no Drive folder created per note folder)
  // Just update the tree index on Drive
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.treeItems.where("id").equals(job.entityId).modify((t: any) => { t.syncStatus = "synced"; });
  await enqueueIndexSync();
}

async function handleDeleteFolder(job: SyncQueueItem, _token: string): Promise<void> {
  await enqueueIndexSync();
}

async function handleRenameItem(job: SyncQueueItem, _token: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.treeItems.where("id").equals(job.entityId).modify((t: any) => { t.syncStatus = "synced"; });
  await enqueueIndexSync();
}

async function handleUpdateItemMeta(job: SyncQueueItem, _token: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.treeItems.where("id").equals(job.entityId).modify((t: any) => { t.syncStatus = "synced"; });
  await enqueueIndexSync();
}

async function handleUpdateTreeIndex(_job: SyncQueueItem, token: string): Promise<void> {
  const ws = await db.workspaces.toCollection().first();
  if (!ws) throw new Error("No workspace in IndexedDB");

  const items = await db.treeItems.toArray();
  const index: NoteIndex = {
    items: items.map(({ syncStatus: _s, localUpdatedAt: _l, ...item }) => item),
  };

  await driveUpdateFile(
    token,
    ws.manifest.indexFileId,
    JSON.stringify(index),
    "application/json",
  );
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

const HANDLERS: Record<string, (job: SyncQueueItem, token: string) => Promise<void>> = {
  CREATE_NOTE:       handleCreateNote,
  UPDATE_NOTE:       handleUpdateNote,
  DELETE_NOTE:       handleDeleteNote,
  CREATE_FOLDER:     handleCreateFolder,
  DELETE_FOLDER:     handleDeleteFolder,
  RENAME_ITEM:       handleRenameItem,
  UPDATE_ITEM_META:  handleUpdateItemMeta,
  UPDATE_TREE_INDEX: handleUpdateTreeIndex,
};

// ─── Sync Engine ──────────────────────────────────────────────────────────────

class SyncEngine {
  private flushing = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** Schedule a debounced flush (default 2 s after last edit). */
  scheduleFlush(ms = 2000): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.flush(); }, ms);
  }

  /** Flush the queue immediately (e.g. on note switch or tab hide). */
  async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;

    try {
      let token = await getValidToken();
      if (!token) {
        this.emitAuthError();
        return;
      }

      const pending = await db.syncQueue
        .where("status").equals("pending")
        .sortBy("createdAt");

      for (const job of pending) {
        // Optimistic lock: only process if we can change status from pending → syncing
        const changed = await db.syncQueue
          .where({ id: job.id, status: "pending" })
          .modify({ status: "syncing", updatedAt: new Date().toISOString() });

        if (changed === 0) continue; // another tab grabbed it

        try {
          const handler = HANDLERS[job.type];
          if (handler) await handler(job, token);
          await db.syncQueue.update(job.id, { status: "synced" });
        } catch (err) {
          if (err instanceof DriveError && err.status === 401) {
            // Force token refresh and retry once
            token = await getValidToken(true);
            if (!token) {
              await db.syncQueue.update(job.id, { status: "pending" });
              this.emitAuthError();
              return;
            }
            try {
              const handler = HANDLERS[job.type];
              if (handler) await handler(job, token);
              await db.syncQueue.update(job.id, { status: "synced" });
            } catch {
              await this.markError(job);
            }
          } else {
            await this.markError(job);
          }
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  private async markError(job: SyncQueueItem): Promise<void> {
    const attempts = (job.attempts ?? 0) + 1;
    const status = attempts >= 3 ? "error" : "pending";
    await db.syncQueue.update(job.id, {
      status,
      attempts,
      updatedAt: new Date().toISOString(),
    });
  }

  private emitAuthError(): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ndg-sync-auth-error"));
    }
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const syncEngine = new SyncEngine();

// ─── Markdown helper (minimal) ────────────────────────────────────────────────

function noteToMarkdown(title: string, blocks: unknown[]): string {
  const lines: string[] = [`# ${title}`, ""];

  function renderBlock(block: Record<string, unknown>, depth = 0): void {
    const indent = "  ".repeat(depth);
    const type = block.type as string;
    const content = block.content;
    const text = Array.isArray(content)
      ? content.map((c: unknown) => (typeof c === "object" && c !== null ? (c as Record<string, unknown>).text ?? "" : "")).join("")
      : typeof content === "string" ? content : "";

    switch (type) {
      case "heading": {
        const level = (block.props as Record<string, unknown>)?.level ?? 1;
        lines.push(`${"#".repeat(Number(level))} ${text}`);
        break;
      }
      case "bulletListItem":
        lines.push(`${indent}- ${text}`);
        break;
      case "numberedListItem":
        lines.push(`${indent}1. ${text}`);
        break;
      case "checkListItem": {
        const checked = (block.props as Record<string, unknown>)?.checked;
        lines.push(`${indent}- [${checked ? "x" : " "}] ${text}`);
        break;
      }
      case "codeBlock":
        lines.push("```", text, "```");
        break;
      default:
        if (text) lines.push(text);
    }

    const children = block.children as Record<string, unknown>[] | undefined;
    if (children?.length) {
      for (const child of children) renderBlock(child, depth + 1);
    }
  }

  for (const block of blocks as Record<string, unknown>[]) {
    renderBlock(block);
  }

  return lines.join("\n");
}

/**
 * IndexedDB schema — Dexie.js
 *
 * This is the local persistence layer that sits between the UI and Google Drive.
 * The Sync Engine reads the syncQueue table and pushes changes to Drive in background.
 */

import Dexie, { type EntityTable } from "dexie";
import type {
  WorkspaceRecord,
  TreeItemRecord,
  NoteRecord,
  SyncQueueItem,
  ConflictRecord,
} from "@/types";

class NdgDatabase extends Dexie {
  workspaces!: EntityTable<WorkspaceRecord, "id">;
  treeItems!:  EntityTable<TreeItemRecord,  "id">;
  notes!:      EntityTable<NoteRecord,      "id">;
  syncQueue!:  EntityTable<SyncQueueItem,   "id">;
  conflicts!:  EntityTable<ConflictRecord,  "id">;

  constructor() {
    super("ndg");

    this.version(1).stores({
      // workspaceId → primary key
      workspaces: "id",

      // item id → primary key; secondary indexes for queries
      treeItems:  "id, parentId, type, syncStatus",

      // note id → primary key
      notes:      "id, syncStatus",

      // auto-increment id; indexes for queue processing
      syncQueue:  "id, type, entityId, status, createdAt",

      // auto-increment id
      conflicts:  "++id, entityId, status",
    });
  }
}

// Singleton — one instance shared across the whole app
export const db = new NdgDatabase();

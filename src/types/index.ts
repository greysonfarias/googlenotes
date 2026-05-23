export interface Manifest {
  workspaceId: string;
  name: string;
  version: number;
  rootFolderId: string;
  systemFolderId: string;
  notesFolderId: string;
  markdownFolderId: string;
  assetsFolderId: string;
  trashFolderId: string;
  manifestFileId: string;
  indexFileId: string;
  settingsFileId: string;
  createdAt: string;
  updatedAt: string;
}

export interface IndexItem {
  id: string;
  type: "folder" | "note";
  title: string;
  parentId: string | null;
  order: number;
  icon?: string;
  description?: string;
  driveFileId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface NoteIndex {
  items: IndexItem[];
}

export interface NoteBlock {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: NoteBlock[];
}

export interface Attachment {
  id: string;           // local UUID
  driveFileId: string;  // Google Drive file ID
  name: string;
  mimeType: string;
  size: number;         // bytes
  addedAt: string;      // ISO date
}

export interface Note {
  id: string;
  title: string;
  icon?: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  blocks: NoteBlock[];
  attachments?: Attachment[];
}

export interface AppSession {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  accessToken?: string;
  error?: string;
}

// ─── IndexedDB / Sync types ──────────────────────────────────────────────────

export type SyncStatus = "synced" | "pending" | "syncing" | "error" | "conflict";

export type SyncOpType =
  | "CREATE_NOTE"
  | "UPDATE_NOTE"
  | "DELETE_NOTE"
  | "CREATE_FOLDER"
  | "DELETE_FOLDER"
  | "RENAME_ITEM"
  | "UPDATE_ITEM_META"
  | "UPDATE_TREE_INDEX";

export interface SyncQueueItem {
  id: string;
  type: SyncOpType;
  entityId: string;
  payload?: {
    driveFileId?: string;      // needed for DELETE ops (entity already removed locally)
    markdownFileId?: string;
  };
  status: "pending" | "syncing" | "synced" | "error";
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceRecord {
  id: string;           // workspaceId
  manifest: Manifest;
  syncedAt: string;     // ISO — last Drive verification
}

export interface TreeItemRecord extends IndexItem {
  syncStatus: SyncStatus;
  localUpdatedAt: string;
}

export interface NoteRecord extends Note {
  syncStatus: SyncStatus;
  localUpdatedAt: string;
}

export interface ConflictRecord {
  id?: number;          // auto-increment
  entityId: string;
  entityType: "note" | "treeItem";
  localVersion: unknown;
  driveVersion: unknown;
  detectedAt: string;
  status: "pending" | "resolved";
  resolution?: "keep_local" | "use_drive" | "duplicate";
}

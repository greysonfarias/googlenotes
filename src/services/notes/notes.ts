import { Note, NoteIndex, NoteBlock } from "@/types";
import {
  createFile,
  updateFile,
  readFile,
  deleteFile,
} from "@/services/google/drive";
import { loadIndex, updateIndex } from "./workspace";
import { generateId, noteBlocksToMarkdown } from "@/lib/utils";

export async function createNote(
  accessToken: string,
  title: string,
  parentId: string | null,
  notesFolderId: string,
  markdownFolderId: string,
  indexFileId: string,
  icon?: string
): Promise<{ note: Note; driveFileId: string }> {
  const now = new Date().toISOString();
  const noteId = generateId("note");

  const note: Note = {
    id: noteId,
    title,
    icon: icon || "",
    parentId,
    createdAt: now,
    updatedAt: now,
    blocks: [
      {
        id: generateId("block"),
        type: "paragraph",
        content: [],
      },
    ],
  };

  const noteFileId = await createFile(
    accessToken,
    `${noteId}.json`,
    JSON.stringify(note, null, 2),
    "application/json",
    notesFolderId
  );

  const markdown = noteBlocksToMarkdown(title, note.blocks as Array<{ type: string; content?: unknown; props?: Record<string, unknown> }>);
  await createFile(
    accessToken,
    `${noteId}.md`,
    markdown,
    "text/markdown",
    markdownFolderId
  );

  const index = await loadIndex(accessToken, indexFileId);
  const maxOrder = index.items
    .filter((i) => i.parentId === parentId)
    .reduce((max, i) => Math.max(max, i.order), 0);

  index.items.push({
    id: noteId,
    type: "note",
    title,
    icon: icon || "",
    parentId,
    order: maxOrder + 1,
    driveFileId: noteFileId,
    createdAt: now,
    updatedAt: now,
  });

  await updateIndex(accessToken, indexFileId, index);

  return { note, driveFileId: noteFileId };
}

export async function loadNote(
  accessToken: string,
  driveFileId: string
): Promise<Note> {
  const content = await readFile(accessToken, driveFileId);
  return JSON.parse(content) as Note;
}

export async function updateNote(
  accessToken: string,
  note: Note,
  driveFileId: string,
  markdownFolderId: string,
  indexFileId: string
): Promise<void> {
  const updatedNote = { ...note, updatedAt: new Date().toISOString() };

  await updateFile(
    accessToken,
    driveFileId,
    JSON.stringify(updatedNote, null, 2),
    "application/json"
  );

  const markdown = noteBlocksToMarkdown(
    note.title,
    note.blocks as Array<{ type: string; content?: unknown; props?: Record<string, unknown> }>
  );

  try {
    const { findFile } = await import("@/services/google/drive");
    const mdFileId = await findFile(
      accessToken,
      `${note.id}.md`,
      markdownFolderId
    );
    if (mdFileId) {
      await updateFile(accessToken, mdFileId, markdown, "text/markdown");
    }
  } catch {
    // markdown sync is best-effort
  }

  const index = await loadIndex(accessToken, indexFileId);
  const itemIndex = index.items.findIndex((i) => i.id === note.id);
  if (itemIndex >= 0) {
    index.items[itemIndex].title = note.title;
    index.items[itemIndex].icon = note.icon;
    index.items[itemIndex].updatedAt = updatedNote.updatedAt;
    await updateIndex(accessToken, indexFileId, index);
  }
}

export async function deleteNote(
  accessToken: string,
  noteId: string,
  driveFileId: string,
  markdownFolderId: string,
  indexFileId: string
): Promise<void> {
  await deleteFile(accessToken, driveFileId);

  try {
    const { findFile } = await import("@/services/google/drive");
    const mdFileId = await findFile(
      accessToken,
      `${noteId}.md`,
      markdownFolderId
    );
    if (mdFileId) await deleteFile(accessToken, mdFileId);
  } catch {
    // best-effort
  }

  const index = await loadIndex(accessToken, indexFileId);
  index.items = removeItemAndDescendants(index.items, noteId);
  await updateIndex(accessToken, indexFileId, index);
}

export async function createFolder(
  accessToken: string,
  title: string,
  parentId: string | null,
  indexFileId: string,
  icon?: string
): Promise<string> {
  const folderId = generateId("folder");
  const now = new Date().toISOString();
  const index = await loadIndex(accessToken, indexFileId);

  const maxOrder = index.items
    .filter((i) => i.parentId === parentId)
    .reduce((max, i) => Math.max(max, i.order), 0);

  index.items.push({
    id: folderId,
    type: "folder",
    title,
    icon: icon || "",
    parentId,
    order: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  });

  await updateIndex(accessToken, indexFileId, index);
  return folderId;
}

export async function deleteFolder(
  accessToken: string,
  folderId: string,
  indexFileId: string
): Promise<void> {
  const index = await loadIndex(accessToken, indexFileId);
  index.items = removeItemAndDescendants(index.items, folderId);
  await updateIndex(accessToken, indexFileId, index);
}

export async function renameItem(
  accessToken: string,
  itemId: string,
  newTitle: string,
  indexFileId: string
): Promise<void> {
  const index = await loadIndex(accessToken, indexFileId);
  const item = index.items.find((i) => i.id === itemId);
  if (item) {
    item.title = newTitle;
    item.updatedAt = new Date().toISOString();
    await updateIndex(accessToken, indexFileId, index);
  }
}

export async function updateItemMeta(
  accessToken: string,
  itemId: string,
  updates: { icon?: string; description?: string },
  indexFileId: string
): Promise<void> {
  const index = await loadIndex(accessToken, indexFileId);
  const item = index.items.find((i) => i.id === itemId);
  if (item) {
    if (updates.icon !== undefined) item.icon = updates.icon;
    if (updates.description !== undefined) item.description = updates.description;
    await updateIndex(accessToken, indexFileId, index);
  }
}

export async function updateItemIcon(
  accessToken: string,
  itemId: string,
  icon: string,
  indexFileId: string
): Promise<void> {
  await updateItemMeta(accessToken, itemId, { icon }, indexFileId);
}

export async function moveItem(
  accessToken: string,
  itemId: string,
  newParentId: string | null,
  indexFileId: string
): Promise<void> {
  const index = await loadIndex(accessToken, indexFileId);
  const item = index.items.find((i) => i.id === itemId);
  if (item) {
    item.parentId = newParentId;
    const maxOrder = index.items
      .filter((i) => i.parentId === newParentId && i.id !== itemId)
      .reduce((max, i) => Math.max(max, i.order), 0);
    item.order = maxOrder + 1;
    item.updatedAt = new Date().toISOString();
    await updateIndex(accessToken, indexFileId, index);
  }
}

export async function exportNoteToMarkdown(
  accessToken: string,
  driveFileId: string
): Promise<string> {
  const note = await loadNote(accessToken, driveFileId);
  return noteBlocksToMarkdown(
    note.title,
    note.blocks as Array<{ type: string; content?: unknown; props?: Record<string, unknown> }>
  );
}

function removeItemAndDescendants(
  items: NoteIndex["items"],
  itemId: string
): NoteIndex["items"] {
  const childIds = items
    .filter((i) => i.parentId === itemId)
    .map((i) => i.id);

  let result = items.filter((i) => i.id !== itemId);
  for (const childId of childIds) {
    result = removeItemAndDescendants(result, childId);
  }
  return result;
}

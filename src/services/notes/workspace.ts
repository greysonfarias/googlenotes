import { Manifest, NoteIndex } from "@/types";
import {
  findFolder,
  createFolder,
  findFile,
  createFile,
  updateFile,
  readFile,
} from "@/services/google/drive";
import { generateId } from "@/lib/utils";

const ROOT_FOLDER_NAME = "Notes do Google";
const SYSTEM_FOLDER_NAME = ".system";

export async function initializeWorkspace(
  accessToken: string
): Promise<Manifest> {
  const existingManifest = await loadManifest(accessToken);
  if (existingManifest) return existingManifest;

  const rootFolderId = await createFolder(accessToken, ROOT_FOLDER_NAME);
  const systemFolderId = await createFolder(
    accessToken,
    SYSTEM_FOLDER_NAME,
    rootFolderId
  );
  const notesFolderId = await createFolder(
    accessToken,
    "notes",
    rootFolderId
  );
  const markdownFolderId = await createFolder(
    accessToken,
    "markdown",
    rootFolderId
  );
  const assetsFolderId = await createFolder(
    accessToken,
    "assets",
    rootFolderId
  );
  await createFolder(accessToken, "images", assetsFolderId);
  await createFolder(accessToken, "attachments", assetsFolderId);
  const trashFolderId = await createFolder(accessToken, "trash", rootFolderId);

  const now = new Date().toISOString();
  const manifest: Manifest = {
    workspaceId: generateId("ws"),
    name: ROOT_FOLDER_NAME,
    version: 1,
    rootFolderId,
    systemFolderId,
    notesFolderId,
    markdownFolderId,
    assetsFolderId,
    trashFolderId,
    manifestFileId: "",
    indexFileId: "",
    settingsFileId: "",
    createdAt: now,
    updatedAt: now,
  };

  const emptyIndex: NoteIndex = { items: [] };
  const defaultSettings = {
    theme: "light",
    autoSaveDelay: 1000,
  };

  const manifestFileId = await createFile(
    accessToken,
    "manifest.json",
    JSON.stringify(manifest, null, 2),
    "application/json",
    systemFolderId
  );

  const indexFileId = await createFile(
    accessToken,
    "index.json",
    JSON.stringify(emptyIndex, null, 2),
    "application/json",
    systemFolderId
  );

  const settingsFileId = await createFile(
    accessToken,
    "settings.json",
    JSON.stringify(defaultSettings, null, 2),
    "application/json",
    systemFolderId
  );

  manifest.manifestFileId = manifestFileId;
  manifest.indexFileId = indexFileId;
  manifest.settingsFileId = settingsFileId;
  manifest.updatedAt = new Date().toISOString();

  await updateFile(
    accessToken,
    manifestFileId,
    JSON.stringify(manifest, null, 2),
    "application/json"
  );

  return manifest;
}

export async function loadManifest(
  accessToken: string
): Promise<Manifest | null> {
  try {
    const rootFolderId = await findFolder(accessToken, ROOT_FOLDER_NAME);
    if (!rootFolderId) return null;

    const systemFolderId = await findFolder(
      accessToken,
      SYSTEM_FOLDER_NAME,
      rootFolderId
    );
    if (!systemFolderId) return null;

    const manifestFileId = await findFile(
      accessToken,
      "manifest.json",
      systemFolderId
    );
    if (!manifestFileId) return null;

    const content = await readFile(accessToken, manifestFileId);
    return JSON.parse(content) as Manifest;
  } catch {
    return null;
  }
}

export async function loadIndex(
  accessToken: string,
  indexFileId: string
): Promise<NoteIndex> {
  try {
    const content = await readFile(accessToken, indexFileId);
    return JSON.parse(content) as NoteIndex;
  } catch {
    return { items: [] };
  }
}

export async function updateIndex(
  accessToken: string,
  indexFileId: string,
  index: NoteIndex
): Promise<void> {
  await updateFile(
    accessToken,
    indexFileId,
    JSON.stringify(index, null, 2),
    "application/json"
  );
}

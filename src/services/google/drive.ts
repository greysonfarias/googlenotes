import { google } from "googleapis";

function getDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
}

export async function findFolder(
  accessToken: string,
  name: string,
  parentId?: string
): Promise<string | null> {
  const drive = getDriveClient(accessToken);

  let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) query += ` and '${parentId}' in parents`;

  const res = await drive.files.list({
    q: query,
    fields: "files(id, name)",
    spaces: "drive",
  });

  const files = res.data.files ?? [];
  return files.length > 0 ? files[0].id! : null;
}

export async function createFolder(
  accessToken: string,
  name: string,
  parentId?: string
): Promise<string> {
  const drive = getDriveClient(accessToken);

  const metadata: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) metadata.parents = [parentId];

  const res = await drive.files.create({
    requestBody: metadata,
    fields: "id",
  });

  return res.data.id!;
}

export async function findOrCreateFolder(
  accessToken: string,
  name: string,
  parentId?: string
): Promise<string> {
  const existing = await findFolder(accessToken, name, parentId);
  if (existing) return existing;
  return createFolder(accessToken, name, parentId);
}

export async function createFile(
  accessToken: string,
  name: string,
  content: string,
  mimeType: string,
  parentId: string
): Promise<string> {
  const drive = getDriveClient(accessToken);

  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType,
      parents: [parentId],
    },
    media: {
      mimeType,
      body: content,
    },
    fields: "id",
  });

  return res.data.id!;
}

export async function updateFile(
  accessToken: string,
  fileId: string,
  content: string,
  mimeType: string
): Promise<void> {
  const drive = getDriveClient(accessToken);

  await drive.files.update({
    fileId,
    media: {
      mimeType,
      body: content,
    },
  });
}

export async function readFile(
  accessToken: string,
  fileId: string
): Promise<string> {
  const drive = getDriveClient(accessToken);

  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "text" }
  );

  return res.data as string;
}

export async function deleteFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  const drive = getDriveClient(accessToken);
  await drive.files.delete({ fileId });
}

export async function trashFile(
  accessToken: string,
  fileId: string,
  trashFolderId: string,
  name: string
): Promise<void> {
  const drive = getDriveClient(accessToken);
  await drive.files.update({
    fileId,
    requestBody: {
      name: `${name}_${Date.now()}`,
      parents: undefined,
    },
    addParents: trashFolderId,
    removeParents: undefined,
  });
}

export async function findFile(
  accessToken: string,
  name: string,
  parentId: string
): Promise<string | null> {
  const drive = getDriveClient(accessToken);

  const res = await drive.files.list({
    q: `name='${name}' and '${parentId}' in parents and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  const files = res.data.files ?? [];
  return files.length > 0 ? files[0].id! : null;
}

export async function uploadImage(
  accessToken: string,
  name: string,
  base64Data: string,
  mimeType: string,
  parentId: string
): Promise<{ fileId: string; webViewLink: string }> {
  const drive = getDriveClient(accessToken);

  const buffer = Buffer.from(base64Data, "base64");
  const { Readable } = await import("stream");
  const stream = Readable.from(buffer);

  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType,
      parents: [parentId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: "id, webViewLink, webContentLink",
  });

  return {
    fileId: res.data.id!,
    webViewLink: res.data.webViewLink ?? "",
  };
}

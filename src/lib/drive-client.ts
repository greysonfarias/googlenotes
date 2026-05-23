/**
 * Client-side Google Drive API wrapper.
 *
 * Called directly from the browser using the access token obtained from getSession().
 * The token is NEVER stored here — it is always passed as a parameter.
 *
 * Mirrors src/services/google/drive.ts but uses fetch instead of the googleapis Node SDK.
 */

const DRIVE_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";

// ─── Error ───────────────────────────────────────────────────────────────────

export class DriveError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DriveError";
  }
}

async function assertOk(res: Response): Promise<void> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new DriveError(`Drive API ${res.status}: ${body}`, res.status);
  }
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

// ─── File operations ──────────────────────────────────────────────────────────

/**
 * Create a file with text content (multipart upload — metadata + media in one request).
 * Returns the Drive file ID.
 */
export async function driveCreateFile(
  token: string,
  name: string,
  content: string,
  mimeType: string,
  parentId: string,
): Promise<string> {
  const metadata = JSON.stringify({ name, parents: [parentId], mimeType });
  const boundary = "ndg_boundary";

  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadata,
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    "",
    content,
    `--${boundary}--`,
  ].join("\r\n");

  const res = await fetch(
    `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id`,
    {
      method: "POST",
      headers: {
        ...authHeaders(token),
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  await assertOk(res);
  const data = await res.json() as { id: string };
  return data.id;
}

/**
 * Update the content of an existing file (media-only upload).
 */
export async function driveUpdateFile(
  token: string,
  fileId: string,
  content: string,
  mimeType = "application/json",
): Promise<void> {
  const res = await fetch(
    `${DRIVE_UPLOAD}/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(token),
        "Content-Type": mimeType,
      },
      body: content,
    },
  );
  await assertOk(res);
}

/**
 * Read the raw text content of a file.
 */
export async function driveReadFile(
  token: string,
  fileId: string,
): Promise<string> {
  const res = await fetch(
    `${DRIVE_BASE}/files/${fileId}?alt=media`,
    {
      headers: authHeaders(token),
    },
  );
  await assertOk(res);
  return res.text();
}

/**
 * Permanently delete a file.
 */
export async function driveDeleteFile(
  token: string,
  fileId: string,
): Promise<void> {
  const res = await fetch(`${DRIVE_BASE}/files/${fileId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  // 404 is fine — file may have been deleted already
  if (!res.ok && res.status !== 404) {
    await assertOk(res);
  }
}

// ─── Folder operations ────────────────────────────────────────────────────────

/**
 * Create a Drive folder (no content, only metadata).
 * Returns the Drive folder ID.
 */
export async function driveCreateFolder(
  token: string,
  name: string,
  parentId?: string,
): Promise<string> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) metadata.parents = [parentId];

  const res = await fetch(`${DRIVE_BASE}/files?fields=id`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  await assertOk(res);
  const data = await res.json() as { id: string };
  return data.id;
}

/**
 * Upload a binary File object to Drive (multipart upload).
 * Uses Blob concatenation so binary content is handled correctly.
 * Returns the created file's metadata.
 */
export async function driveUploadFile(
  token: string,
  file: File,
  parentId: string,
): Promise<{ id: string; name: string; mimeType: string; size: number }> {
  const metadata = JSON.stringify({ name: file.name, parents: [parentId] });
  const boundary = "ndg_up_" + Math.random().toString(36).slice(2);
  const mimeType = file.type || "application/octet-stream";

  // Blob concatenation handles binary files correctly (no string encoding issues)
  const body = new Blob([
    `--${boundary}\r\n`,
    `Content-Type: application/json; charset=UTF-8\r\n\r\n`,
    metadata,
    `\r\n--${boundary}\r\n`,
    `Content-Type: ${mimeType}\r\n\r\n`,
    file,
    `\r\n--${boundary}--`,
  ]);

  const res = await fetch(
    `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,mimeType,size`,
    {
      method: "POST",
      headers: {
        ...authHeaders(token),
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  await assertOk(res);
  return res.json() as Promise<{ id: string; name: string; mimeType: string; size: number }>;
}

/**
 * Fetch file metadata (e.g. modifiedTime) to detect if Drive is newer.
 */
export async function driveGetFileMeta(
  token: string,
  fileId: string,
): Promise<{ id: string; modifiedTime: string; name: string }> {
  const res = await fetch(
    `${DRIVE_BASE}/files/${fileId}?fields=id,modifiedTime,name`,
    {
      headers: authHeaders(token),
    },
  );
  await assertOk(res);
  return res.json() as Promise<{ id: string; modifiedTime: string; name: string }>;
}

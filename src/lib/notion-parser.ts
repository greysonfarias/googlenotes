/**
 * Notion Export Parser
 *
 * Parses a Notion "Markdown & CSV" export ZIP file and converts it into
 * a tree of folders and notes compatible with Notes do Google's IndexedDB schema.
 *
 * Supported export formats:
 *  - Direct ZIP containing .md files (simple page exports)
 *  - Wrapper ZIP containing inner Part-N.zip files (large / database exports)
 *
 * Database exports (flat .md + .csv at the same level) automatically get a
 * parent folder named after the database CSV file.
 */

import JSZip from "jszip";
import { generateId } from "@/lib/utils";
import type { NoteBlock } from "@/types";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ImportedFolder {
  id: string;
  title: string;
  parentId: string | null;
  order: number;
}

export interface ImportedNote {
  id: string;
  title: string;
  parentId: string | null;
  order: number;
  blocks: NoteBlock[];
  createdAt: string;
  updatedAt: string;
}

export interface ParseResult {
  folders: ImportedFolder[];
  notes: ImportedNote[];
  skipped: string[];
  warnings: string[];
}

// ─── Name cleaning ─────────────────────────────────────────────────────────────

/**
 * Notion appends a 32-char hex ID to every file/folder name.
 * e.g. "My Page abc123...def456.md" → "My Page"
 */
function stripNotionId(name: string): string {
  return name
    .replace(/\s[0-9a-f]{8}[0-9a-f]{4}[0-9a-f]{4}[0-9a-f]{4}[0-9a-f]{12}$/i, "")
    .replace(/\s[0-9a-f]{32}$/i, "")
    .trim();
}

function cleanFileName(name: string): string {
  const withoutExt = name.replace(/\.(md|csv|html)$/i, "");
  return stripNotionId(withoutExt);
}

// ─── Markdown → BlockNote blocks ──────────────────────────────────────────────

function makeId(): string {
  return generateId("block");
}

type InlineStyle = { bold?: boolean; italic?: boolean; code?: boolean; strikethrough?: boolean };

interface InlineSegment {
  type: "text";
  text: string;
  styles: InlineStyle;
}

function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const pattern = /(`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_|~~[^~]+~~)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const raw = text.slice(lastIndex, match.index);
      if (raw) segments.push({ type: "text", text: raw, styles: {} });
    }

    const full = match[0];

    if (full.startsWith("`")) {
      segments.push({ type: "text", text: full.slice(1, -1), styles: { code: true } });
    } else if (full.startsWith("***")) {
      segments.push({ type: "text", text: full.slice(3, -3), styles: { bold: true, italic: true } });
    } else if (full.startsWith("**")) {
      segments.push({ type: "text", text: full.slice(2, -2), styles: { bold: true } });
    } else if (full.startsWith("__")) {
      segments.push({ type: "text", text: full.slice(2, -2), styles: { bold: true } });
    } else if (full.startsWith("~~")) {
      segments.push({ type: "text", text: full.slice(2, -2), styles: { strikethrough: true } });
    } else if (full.startsWith("*") || full.startsWith("_")) {
      segments.push({ type: "text", text: full.slice(1, -1), styles: { italic: true } });
    } else {
      segments.push({ type: "text", text: full, styles: {} });
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < text.length) {
    const rest = text.slice(lastIndex);
    if (rest) segments.push({ type: "text", text: rest, styles: {} });
  }

  if (segments.length === 0) {
    segments.push({ type: "text", text, styles: {} });
  }

  return segments;
}

function makeBlock(type: string, text: string, props: Record<string, unknown> = {}): NoteBlock {
  return {
    id: makeId(),
    type,
    props,
    content: parseInline(text),
    children: [],
  };
}

/**
 * Property line pattern: starts with a word/phrase immediately followed by ": "
 * e.g. "Created: May 1, 2024" / "Last Edited Time: ..." / "Created By: ..."
 */
const NOTION_PROP_RE = /^[A-Za-z][a-zA-Z ]*:\s/;

/**
 * Convert Notion markdown to BlockNote blocks.
 * Skips the first # heading (used as note title) and all Notion property lines.
 */
export function markdownToBlocks(markdown: string): { title: string; blocks: NoteBlock[] } {
  const lines = markdown.split("\n");
  const blocks: NoteBlock[] = [];
  let title = "";
  let titleFound = false;
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLanguage = "";
  let inTable = false;

  /**
   * After the title we enter a "skip properties" zone.
   * We stay in this zone while we see:
   *   - blank lines
   *   - table rows (| ... |)
   *   - key: value property lines (e.g. "Created: ...")
   * The first line that doesn't match any of these exits the zone.
   */
  let skipProperties = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();
    const trimmed = line.trim();

    // ── Code block ──────────────────────────────────────────────────────────────
    if (trimmed.startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLanguage = trimmed.slice(3).trim();
        codeLines = [];
      } else {
        inCodeBlock = false;
        blocks.push({
          id: makeId(),
          type: "codeBlock",
          props: { language: codeLanguage || "plain" },
          content: [{ type: "text", text: codeLines.join("\n"), styles: {} }],
          children: [],
        });
        codeLines = [];
        codeLanguage = "";
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(raw);
      continue;
    }

    // ── Properties zone (after title) ───────────────────────────────────────────
    if (skipProperties) {
      // Stay in zone for blank lines, table rows, and key: value lines
      if (!trimmed || trimmed.startsWith("|") || NOTION_PROP_RE.test(trimmed)) {
        if (!trimmed) inTable = false;
        continue;
      }
      // First real content line — exit zone and fall through to process it
      skipProperties = false;
    }

    // ── Empty line ───────────────────────────────────────────────────────────────
    if (!trimmed) {
      inTable = false;
      continue;
    }

    // ── Inline table rows (outside properties zone) ──────────────────────────────
    if (trimmed.startsWith("|")) {
      inTable = true;
      continue;
    }
    if (inTable && /^[-|: ]+$/.test(trimmed)) {
      continue; // table divider row
    }
    inTable = false;

    // ── Headings ─────────────────────────────────────────────────────────────────
    if (trimmed.startsWith("#### ")) {
      blocks.push(makeBlock("heading", trimmed.slice(5), { level: 3 }));
      continue;
    }
    if (trimmed.startsWith("### ")) {
      blocks.push(makeBlock("heading", trimmed.slice(4), { level: 3 }));
      continue;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push(makeBlock("heading", trimmed.slice(3), { level: 2 }));
      continue;
    }
    if (trimmed.startsWith("# ")) {
      if (!titleFound) {
        title = trimmed.slice(2).trim();
        titleFound = true;
        skipProperties = true; // properties / metadata follow the title
        continue;
      }
      blocks.push(makeBlock("heading", trimmed.slice(2), { level: 1 }));
      continue;
    }

    // ── Horizontal rule ──────────────────────────────────────────────────────────
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ id: makeId(), type: "horizontalRule", props: {}, content: [], children: [] });
      continue;
    }

    // ── Checkboxes ───────────────────────────────────────────────────────────────
    if (/^- \[[ x]\] /i.test(trimmed)) {
      const checked = trimmed[3].toLowerCase() === "x";
      blocks.push(makeBlock("checkListItem", trimmed.slice(6), { checked }));
      continue;
    }

    // ── Bullet list ──────────────────────────────────────────────────────────────
    if (/^[-*+] /.test(trimmed)) {
      blocks.push(makeBlock("bulletListItem", trimmed.slice(2)));
      continue;
    }

    // ── Numbered list ────────────────────────────────────────────────────────────
    if (/^\d+\. /.test(trimmed)) {
      blocks.push(makeBlock("numberedListItem", trimmed.replace(/^\d+\.\s+/, "")));
      continue;
    }

    // ── Blockquote ───────────────────────────────────────────────────────────────
    if (trimmed.startsWith("> ")) {
      blocks.push(makeBlock("paragraph", trimmed.slice(2)));
      continue;
    }

    // ── Regular paragraph ────────────────────────────────────────────────────────
    blocks.push(makeBlock("paragraph", trimmed));
  }

  return { title, blocks };
}

// ─── ZIP loading helpers ───────────────────────────────────────────────────────

type ZipEntry = { path: string; file: JSZip.JSZipObject };

/**
 * Collect all file entries from a JSZip instance.
 */
function collectEntries(zip: JSZip): ZipEntry[] {
  const entries: ZipEntry[] = [];
  zip.forEach((relativePath, file) => entries.push({ path: relativePath, file }));
  return entries;
}

/**
 * Notion sometimes packages exports as a "wrapper" ZIP containing one or more
 * inner ZIPs named "*-Part-N.zip". This function detects that pattern and
 * returns the merged flat list of entries from all inner ZIPs.
 *
 * Falls back to returning the outer entries directly if no inner ZIPs are found.
 */
async function resolveEntries(zipFile: File): Promise<ZipEntry[]> {
  const outerZip = await JSZip.loadAsync(zipFile);
  const outerEntries = collectEntries(outerZip);

  const innerZipEntries = outerEntries.filter(
    ({ path, file }) => !file.dir && path.endsWith(".zip"),
  );
  const hasDirectMd = outerEntries.some(
    ({ path, file }) => !file.dir && path.endsWith(".md"),
  );

  if (!hasDirectMd && innerZipEntries.length > 0) {
    // Wrapper ZIP — unpack every inner ZIP and merge their entries
    const merged: ZipEntry[] = [];
    for (const { file: innerFile } of innerZipEntries) {
      const buf = await innerFile.async("arraybuffer");
      const innerZip = await JSZip.loadAsync(buf);
      merged.push(...collectEntries(innerZip));
    }
    return merged;
  }

  return outerEntries;
}

// ─── Main parser ───────────────────────────────────────────────────────────────

export async function parseNotionZip(zipFile: File): Promise<ParseResult> {
  // Step 1 — resolve all file entries (handles nested wrapper ZIPs)
  const allFiles = await resolveEntries(zipFile);

  const result: ParseResult = { folders: [], notes: [], skipped: [], warnings: [] };
  const now = new Date().toISOString();

  const folderIdByPath = new Map<string, string>();   // ZIP dir path → folderId
  const virtualFolderByDir = new Map<string, string>(); // dir → folderId (CSV-based)
  let folderOrder = 0;

  // ── Step 2 — Detect database folders from CSV files ──────────────────────────
  //
  // When Notion exports a database it places a CSV at the same level as the
  // notes.  We create a virtual folder named after the database so all the
  // flat notes land inside it instead of at the root.
  //
  const csvByDir = new Map<string, string>(); // dir path → database name
  for (const { path, file } of allFiles) {
    if (file.dir) continue;
    if (!path.endsWith(".csv") || path.endsWith("_all.csv")) continue;

    const parts = path.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
    const dbName = cleanFileName(parts[parts.length - 1].replace(/\.csv$/, ""));
    if (dbName && !csvByDir.has(dir)) {
      csvByDir.set(dir, dbName);
    }
  }

  // Create a folder for each detected database directory
  for (const [dir, dbName] of csvByDir) {
    // Only create a folder if there are actually .md files in this directory
    const hasMd = allFiles.some(({ path, file }) => {
      if (file.dir || !path.endsWith(".md")) return false;
      const parts = path.split("/");
      const fileDir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
      return fileDir === dir;
    });
    if (!hasMd) continue;

    const folderId = generateId("folder");
    virtualFolderByDir.set(dir, folderId);
    result.folders.push({ id: folderId, title: dbName, parentId: null, order: folderOrder++ });
  }

  // ── Step 3 — Create folder records for real ZIP directories ─────────────────
  const folderPaths = new Set<string>();
  for (const { path, file } of allFiles) {
    if (file.dir) {
      folderPaths.add(path.replace(/\/$/, ""));
    }
  }
  // Also infer missing parent directories from nested file paths
  for (const { path } of allFiles) {
    const parts = path.split("/");
    for (let i = 1; i < parts.length - 1; i++) {
      const dirPath = parts.slice(0, i).join("/");
      if (dirPath) folderPaths.add(dirPath);
    }
  }

  const sortedFolderPaths = [...folderPaths].sort(
    (a, b) => a.split("/").length - b.split("/").length,
  );

  for (const folderPath of sortedFolderPaths) {
    const parts = folderPath.split("/");
    const rawName = parts[parts.length - 1];
    const title = cleanFileName(rawName) || rawName;

    const parentPath = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
    const parentId =
      folderIdByPath.get(parentPath) ??
      virtualFolderByDir.get(parentPath) ??
      null;

    const id = generateId("folder");
    folderIdByPath.set(folderPath, id);
    result.folders.push({ id, title, parentId, order: folderOrder++ });
  }

  // ── Step 4 — Process .md files into notes ────────────────────────────────────
  const mdFiles = allFiles
    .filter(({ path, file }) => !file.dir && path.endsWith(".md"))
    .sort((a, b) => a.path.localeCompare(b.path));

  let noteOrder = 0;
  for (const { path, file } of mdFiles) {
    const parts = path.split("/");
    const rawFileName = parts[parts.length - 1];
    const fileNameWithoutExt = rawFileName.replace(/\.md$/i, "");
    const fileDir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";

    // Resolve parent folder: real ZIP directory → CSV virtual folder → null
    let parentId: string | null =
      folderIdByPath.get(fileDir) ??
      virtualFolderByDir.get(fileDir) ??
      null;

    if (!parentId && parts.length > 1) {
      // Implicit parent — create it on the fly
      const folderTitle =
        cleanFileName(parts[parts.length - 2]) || parts[parts.length - 2];
      const folderId = generateId("folder");
      folderIdByPath.set(fileDir, folderId);
      result.folders.push({ id: folderId, title: folderTitle, parentId: null, order: folderOrder++ });
      parentId = folderId;
    }

    try {
      const content = await file.async("string");
      const { title: mdTitle, blocks } = markdownToBlocks(content);
      const title = mdTitle || cleanFileName(fileNameWithoutExt) || "Sem título";

      result.notes.push({
        id: generateId("note"),
        title,
        parentId,
        order: noteOrder++,
        blocks,
        createdAt: now,
        updatedAt: now,
      });
    } catch {
      result.warnings.push(`Não foi possível processar: ${path}`);
    }
  }

  // ── Step 5 — Mark non-markdown files as skipped ───────────────────────────────
  for (const { path, file } of allFiles) {
    if (!file.dir && !path.endsWith(".md")) {
      if (/\.(csv|html|htm|png|jpg|jpeg|gif|webp|svg|pdf|zip)$/i.test(path)) {
        result.skipped.push(path);
      }
    }
  }

  return result;
}

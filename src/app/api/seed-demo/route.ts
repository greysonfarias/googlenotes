/**
 * POST /api/seed-demo
 *
 * Creates a realistic demo workspace tree for screenshots / articles.
 * Safe to call multiple times — uses a guard item in the index to skip if already seeded.
 *
 * Strategy: build the entire index in memory, create all note files in parallel,
 * write the index once. Fast (~10 s total).
 */

import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-factory";
import {
  createFile,
  updateFile,
  readFile,
} from "@/services/google/drive";
import { loadManifest } from "@/services/notes/workspace";
import { generateId } from "@/lib/utils";
import type { IndexItem, Note, NoteBlock, NoteIndex } from "@/types";

// ─── Demo tree definition ─────────────────────────────────────────────────────

interface FolderDef {
  title: string;
  icon: string;
  children: (FolderDef | NoteDef)[];
}
interface NoteDef {
  title: string;
  icon?: string;
  preview: string; // first paragraph text shown in the note body
}
function isNote(x: FolderDef | NoteDef): x is NoteDef {
  return !("children" in x);
}

const DEMO_TREE: FolderDef[] = [
  {
    title: "Work",
    icon: "💼",
    children: [
      { title: "Q2 Goals", icon: "🎯", preview: "OKRs and key results for Q2 2026. Focus on growth, reliability, and team velocity." },
      { title: "Team Standup", preview: "Daily async updates. What did you ship? What's blocking you?" },
      { title: "1:1 Agenda", preview: "Topics for the next 1:1 with the engineering lead." },
      {
        title: "Projects",
        icon: "📂",
        children: [
          { title: "Product Roadmap", icon: "🗺️", preview: "High-level roadmap for H2 2026. Three themes: onboarding, performance, integrations." },
          { title: "API Redesign", preview: "Proposal for the v2 REST API. Breaking changes, migration guide, timeline." },
          { title: "Design System", icon: "🎨", preview: "Component library decisions, token naming, Figma handoff process." },
        ],
      },
    ],
  },
  {
    title: "Personal",
    icon: "🏠",
    children: [
      { title: "Goals 2026", icon: "⭐", preview: "Health, finances, learning, travel. One page, honest." },
      { title: "Morning Routine", preview: "6:30 wake. Water. 20 min walk. Read. Write 3 things. No phone until 8." },
      { title: "Monthly Budget", icon: "💰", preview: "Track income, fixed costs, discretionary. Review on the 1st of every month." },
      { title: "Travel Plans", icon: "✈️", preview: "Amsterdam in June. Tokyo in October. Check visa requirements." },
    ],
  },
  {
    title: "Journal",
    icon: "📔",
    children: [
      { title: "May 23 · Friday", preview: "Good day overall. Shipped the new sync engine. Felt the flow for the first time in weeks." },
      { title: "May 19 · Monday", preview: "Hard start. Coffee helped. Cleared 12 items from the backlog before lunch." },
      { title: "May 12 · Monday", preview: "Retrospective went well. Team morale is up. Need to document the new architecture." },
      { title: "Reflections — April", icon: "🌿", preview: "April was the month of shipping slowly and thinking deeply. Proud of what we built." },
    ],
  },
  {
    title: "Todo",
    icon: "✅",
    children: [
      {
        title: "Work",
        icon: "📋",
        children: [
          { title: "This Week", preview: "[ ] Review PR #412\n[ ] Sync with design on onboarding flow\n[ ] Update Notion → Drive migration guide" },
          { title: "Backlog", preview: "Things that matter but don't need to happen now. Revisit every Friday." },
        ],
      },
      {
        title: "Personal",
        icon: "📋",
        children: [
          { title: "Home Projects", preview: "[ ] Fix the kitchen shelf\n[ ] Set up the new monitor\n[ ] Deep clean the office" },
          { title: "Wishlist", icon: "🛍️", preview: "Kindle Scribe. Standing desk mat. Good headphones. A plant." },
        ],
      },
    ],
  },
  {
    title: "Reads",
    icon: "📚",
    children: [
      {
        title: "Books",
        icon: "📗",
        children: [
          { title: "Atomic Habits", icon: "⚡", preview: "Make it obvious. Make it attractive. Make it easy. Make it satisfying. Identity-based change." },
          { title: "Deep Work", preview: "Ability to focus without distraction is becoming rare and valuable. Schedule it. Protect it." },
          { title: "The Creative Act", icon: "🎵", preview: "Rick Rubin on creativity. Pay attention. Notice. Serve the work." },
        ],
      },
      { title: "Articles Backlog", preview: "Links to read this weekend. No more than 10 at a time." },
      { title: "Highlights & Quotes", icon: "✏️", preview: "The best sentences I've read. Slow down for the ones that stop you." },
    ],
  },
];

// ─── Block builders ───────────────────────────────────────────────────────────

function textBlock(text: string): NoteBlock {
  return {
    id: generateId("block"),
    type: "paragraph",
    content: [{ type: "text", text, styles: {} }],
  } as NoteBlock;
}

function headingBlock(text: string, level = 2): NoteBlock {
  return {
    id: generateId("block"),
    type: "heading",
    props: { level, textColor: "default", backgroundColor: "default", textAlignment: "left" },
    content: [{ type: "text", text, styles: {} }],
    children: [],
  } as NoteBlock;
}

function buildNoteBlocks(preview: string): NoteBlock[] {
  const lines = preview.split("\n").filter(Boolean);
  return lines.map((line) => textBlock(line));
}

// ─── Recursive tree builder ───────────────────────────────────────────────────

interface BuildResult {
  indexItems: IndexItem[];
  noteCreations: Array<() => Promise<void>>;  // deferred so we can run in parallel
}

function buildTree(
  nodes: (FolderDef | NoteDef)[],
  parentId: string | null,
  startOrder: number,
  notesFolderId: string,
  markdownFolderId: string,
  accessToken: string,
  result: BuildResult,
): void {
  let order = startOrder;

  for (const node of nodes) {
    const id = generateId(isNote(node) ? "note" : "folder");
    const now = new Date().toISOString();

    if (isNote(node)) {
      const note: Note = {
        id,
        title: node.title,
        icon: node.icon ?? "",
        parentId,
        createdAt: now,
        updatedAt: now,
        blocks: [
          headingBlock(node.title),
          ...buildNoteBlocks(node.preview),
          { id: generateId("block"), type: "paragraph", content: [], children: [] } as NoteBlock,
        ],
      };

      const noteJson = JSON.stringify(note, null, 2);
      const mdContent = `# ${node.title}\n\n${node.preview}`;

      // Capture driveFileId asynchronously — will be set when the promise resolves
      const indexEntry: IndexItem = {
        id,
        type: "note",
        title: node.title,
        icon: node.icon ?? "",
        parentId,
        order,
        createdAt: now,
        updatedAt: now,
        driveFileId: undefined, // filled in after creation
      };
      result.indexItems.push(indexEntry);

      result.noteCreations.push(async () => {
        const driveFileId = await createFile(
          accessToken,
          `${id}.json`,
          noteJson,
          "application/json",
          notesFolderId,
        );
        indexEntry.driveFileId = driveFileId;

        // markdown — best-effort
        await createFile(
          accessToken,
          `${id}.md`,
          mdContent,
          "text/markdown",
          markdownFolderId,
        ).catch(() => {/* ignore */});
      });
    } else {
      // Folder
      result.indexItems.push({
        id,
        type: "folder",
        title: node.title,
        icon: node.icon ?? "",
        parentId,
        order,
        createdAt: now,
        updatedAt: now,
      });

      buildTree(
        node.children,
        id,
        1,
        notesFolderId,
        markdownFolderId,
        accessToken,
        result,
      );
    }

    order++;
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST() {
  const session = await getServerSession();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const token = session.accessToken as string;

  try {
    // 1. Load manifest
    const manifest = await loadManifest(token);
    if (!manifest) {
      return NextResponse.json({ error: "Workspace não inicializado" }, { status: 400 });
    }

    // 2. Check if already seeded (look for a guard item)
    const rawIndex = await readFile(token, manifest.indexFileId);
    const existingIndex = JSON.parse(rawIndex) as NoteIndex;

    const alreadySeeded = existingIndex.items.some(
      (i) => i.title === "Work" && i.parentId === null && i.type === "folder",
    );
    if (alreadySeeded) {
      return NextResponse.json({ ok: true, skipped: true, message: "Workspace já possui dados de demonstração." });
    }

    // 3. Build tree definition in memory
    const result: BuildResult = { indexItems: [], noteCreations: [] };
    buildTree(DEMO_TREE, null, existingIndex.items.length + 1, manifest.notesFolderId, manifest.markdownFolderId, token, result);

    // 4. Create all note files in Drive — concurrently (batched to avoid rate limits)
    const BATCH = 5;
    for (let i = 0; i < result.noteCreations.length; i += BATCH) {
      await Promise.all(result.noteCreations.slice(i, i + BATCH).map((fn) => fn()));
    }

    // 5. Write the full index once
    const updatedIndex: NoteIndex = {
      items: [...existingIndex.items, ...result.indexItems],
    };
    await updateFile(
      token,
      manifest.indexFileId,
      JSON.stringify(updatedIndex, null, 2),
      "application/json",
    );

    // 6. Update manifest updatedAt
    await updateFile(
      token,
      manifest.manifestFileId,
      JSON.stringify({ ...manifest, updatedAt: new Date().toISOString() }, null, 2),
      "application/json",
    );

    return NextResponse.json({
      ok: true,
      folders: result.indexItems.filter((i) => i.type === "folder").length,
      notes:   result.indexItems.filter((i) => i.type === "note").length,
    });
  } catch (err) {
    console.error("[seed-demo]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

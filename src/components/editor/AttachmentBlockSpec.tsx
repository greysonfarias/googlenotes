"use client";

/**
 * Custom BlockNote block for file attachments.
 *
 * Data lives inline in the note's block tree (note.blocks[]).
 * The block knows its own driveFileId, so deletion is self-contained.
 *
 * Delete flow:
 *   1. User clicks 🗑 → editor.removeBlocks([block])  (removes from doc)
 *   2. AttachmentActionsCtx.onDelete(driveFileId)      (deletes from Drive)
 */

import React, { createContext, useContext } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { ExternalLink, Trash2 } from "lucide-react";

// ─── Context (provides Drive-delete callback to the block renderer) ───────────

interface AttachmentCtxValue {
  onDelete: (driveFileId: string) => void;
}
export const AttachmentActionsCtx = createContext<AttachmentCtxValue>({
  onDelete: () => {},
});

// ─── Prop schema ──────────────────────────────────────────────────────────────

export const attachmentPropSchema = {
  driveFileId: { default: "" as string },
  name:        { default: "" as string },
  mimeType:    { default: "" as string },
  size:        { default: "0" as string }, // stored as string — parseInt() on use
  addedAt:     { default: "" as string },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMimeLabel(mimeType: string, name: string): string {
  const ext = name.split(".").pop()?.toUpperCase() ?? "ARQUIVO";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("image/")) return ext;
  if (mimeType.includes("spreadsheet")) return ext;
  if (mimeType.includes("wordprocessingml")) return ext;
  if (mimeType.startsWith("video/")) return ext;
  return ext;
}

function FileTypeBadge({ mimeType, name }: { mimeType: string; name: string }) {
  const ext = name.split(".").pop()?.toUpperCase() ?? "?";
  const isPdf   = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");
  const isSheet = mimeType.includes("spreadsheet") || ext === "XLSX" || ext === "XLS" || ext === "CSV";
  const isDoc   = mimeType.includes("wordprocessingml") || ext === "DOCX" || ext === "DOC";
  const isVideo = mimeType.startsWith("video/");

  const [bg, fg] =
    isPdf   ? ["#fff1f0", "#e53e3e"] :
    isImage ? ["#ebf8ff", "#3182ce"] :
    isSheet ? ["#f0fff4", "#276749"] :
    isDoc   ? ["#ebf4ff", "#2b6cb0"] :
    isVideo ? ["#faf5ff", "#6b46c1"] :
              ["#f7fafc", "#718096"];

  return (
    <div
      className="w-10 h-12 shrink-0 rounded-md flex items-center justify-center border text-[10px] font-bold leading-none select-none"
      style={{ background: bg, borderColor: `${fg}33`, color: fg }}
    >
      {ext.slice(0, 4)}
    </div>
  );
}

// ─── Block renderer ───────────────────────────────────────────────────────────

function AttachmentBlockUI({
  block,
  editor,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  block: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any;
}) {
  const { onDelete } = useContext(AttachmentActionsCtx);
  const { driveFileId, name, mimeType, size, addedAt } = block.props as {
    driveFileId: string;
    name: string;
    mimeType: string;
    size: string;
    addedAt: string;
  };

  const bytes   = parseInt(size, 10) || 0;
  const dateStr = addedAt
    ? new Date(addedAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })
    : "";

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    editor.removeBlocks([block]);
    if (driveFileId) onDelete(driveFileId);
  }

  return (
    <div
      className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[rgba(55,53,47,0.12)] bg-white hover:bg-[rgba(55,53,47,0.02)] transition-colors my-0.5 select-none cursor-default"
      contentEditable={false}
    >
      <FileTypeBadge mimeType={mimeType} name={name} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#37352f] truncate leading-tight">{name || "Arquivo"}</p>
        <p className="text-xs text-[#9b9a97] mt-0.5">
          {getMimeLabel(mimeType, name)} · {formatSize(bytes)}
          {dateStr ? ` · ${dateStr}` : ""}
        </p>
      </div>

      {/* Actions — shown on hover */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {driveFileId && (
          <a
            href={`https://drive.google.com/file/d/${driveFileId}/view`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-md hover:bg-[rgba(55,53,47,0.08)] text-[#9b9a97] hover:text-[#37352f] transition-colors"
            title="Abrir no Drive"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
        <button
          onClick={handleDelete}
          className="p-1.5 rounded-md hover:bg-red-50 text-[#9b9a97] hover:text-red-600 transition-colors"
          title="Remover anexo"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Block spec ───────────────────────────────────────────────────────────────

export const AttachmentBlock = createReactBlockSpec(
  {
    type: "attachment" as const,
    propSchema: attachmentPropSchema,
    content: "none",
  },
  {
    render: ({ block, editor }) => (
      <AttachmentBlockUI block={block} editor={editor} />
    ),
  },
);

// ─── Insert helper type ───────────────────────────────────────────────────────

export interface AttachmentBlockData {
  driveFileId: string;
  name: string;
  mimeType: string;
  size: number;
  addedAt: string;
}

export function makeAttachmentBlock(data: AttachmentBlockData) {
  return {
    type: "attachment" as const,
    props: {
      driveFileId: data.driveFileId,
      name:        data.name,
      mimeType:    data.mimeType,
      size:        String(data.size),
      addedAt:     data.addedAt,
    },
  };
}

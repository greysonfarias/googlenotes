"use client";

import { useRef, useState } from "react";
import {
  Paperclip,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Upload,
  Loader2,
} from "lucide-react";
import { NoteBlock } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeMini({ mimeType, name }: { mimeType: string; name: string }) {
  const ext = name.split(".").pop()?.toUpperCase() ?? "?";
  const isPdf   = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");
  const isSheet = mimeType.includes("spreadsheet") || ext === "XLSX" || ext === "XLS" || ext === "CSV";
  const isDoc   = mimeType.includes("wordprocessingml") || ext === "DOCX" || ext === "DOC";

  const [bg, fg] =
    isPdf   ? ["#fff1f0", "#e53e3e"] :
    isImage ? ["#ebf8ff", "#3182ce"] :
    isSheet ? ["#f0fff4", "#276749"] :
    isDoc   ? ["#ebf4ff", "#2b6cb0"] :
              ["#f7fafc", "#718096"];

  return (
    <div
      className="w-8 h-10 shrink-0 rounded flex items-center justify-center border text-[9px] font-bold leading-none select-none"
      style={{ background: bg, borderColor: `${fg}33`, color: fg }}
    >
      {ext.slice(0, 4)}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AttachmentsSectionProps {
  /** All blocks from the note — section filters for type === "attachment" */
  blocks: NoteBlock[];
  uploading: boolean;
  /** Called when user picks files via the button (inserts at end of doc) */
  onAddFiles: (files: FileList | File[]) => Promise<void>;
}

interface AttachmentProps {
  driveFileId: string;
  name: string;
  mimeType: string;
  size: string;
}

export function AttachmentsSection({ blocks, uploading, onAddFiles }: AttachmentsSectionProps) {
  const [collapsed, setCollapsed] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive attachment list from note blocks
  const attachments = blocks
    .filter((b) => b.type === "attachment")
    .map((b) => (b.props ?? {}) as unknown as AttachmentProps)
    .filter((p) => p.name);

  return (
    <div className="mt-10 border-t border-[rgba(55,53,47,0.09)] pt-5 pb-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-2 hover:text-[#37352f] group py-1"
        >
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5 text-[#9b9a97]" />
            : <ChevronDown  className="w-3.5 h-3.5 text-[#9b9a97]" />
          }
          <Paperclip className="w-3.5 h-3.5 text-[#9b9a97]" />
          <span className="text-sm text-[rgba(55,53,47,0.65)]">Anexos</span>
          {attachments.length > 0 && (
            <span className="text-xs text-[#9b9a97] ml-0.5">{attachments.length}</span>
          )}
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[#9b9a97] hover:text-[#37352f] hover:bg-[rgba(55,53,47,0.06)] transition-colors disabled:opacity-50"
        >
          {uploading
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <Upload   className="w-3 h-3" />
          }
          Adicionar
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={async (e) => {
            if (e.target.files?.length) await onAddFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* ── Expanded list ── */}
      {!collapsed && (
        <div className="mt-3 ml-5 space-y-0.5">
          {attachments.length === 0 && !uploading && (
            <p className="text-xs text-[#9b9a97] py-1">
              Nenhum anexo — arraste arquivos para o corpo da nota.
            </p>
          )}

          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 group">
              <FileTypeMini mimeType={att.mimeType} name={att.name} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#37352f] truncate">{att.name}</p>
                <p className="text-[11px] text-[#9b9a97]">{formatSize(parseInt(att.size, 10) || 0)}</p>
              </div>
              {att.driveFileId && (
                <a
                  href={`https://drive.google.com/file/d/${att.driveFileId}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded-md hover:bg-[rgba(55,53,47,0.08)] text-[#9b9a97] hover:text-[#37352f] opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Abrir no Drive"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          ))}

          {uploading && (
            <div className="flex items-center gap-2 py-1.5 text-xs text-[#9b9a97]">
              <Loader2 className="w-3 h-3 animate-spin" />
              Enviando para o Google Drive...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

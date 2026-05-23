"use client";

import { useRef, useState } from "react";
import { X, ExternalLink, Loader2, Upload } from "lucide-react";
import { useSession } from "next-auth/react";
import { NoteBlock, Note } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPropDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function DetailRow({ label, value, avatar }: { label: string; value: string; avatar?: string }) {
  return (
    <div>
      <p className="text-[11px] text-[#9b9a97] mb-0.5">{label}</p>
      <div className="flex items-center gap-1.5">
        {avatar && <img src={avatar} alt="" className="w-4 h-4 rounded-full shrink-0" />}
        <p className="text-xs text-[#37352f]">{value}</p>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AttachmentsPanelProps {
  note: Note;
  blocks: NoteBlock[];
  uploading: boolean;
  assetsFolderId?: string;
  onAddFiles: (files: FileList | File[]) => Promise<void>;
  onClose: () => void;
}

type Tab = "attachments" | "details";

interface AttachmentProps {
  driveFileId: string;
  name: string;
  mimeType: string;
  size: string;
}

export function AttachmentsPanel({
  note,
  blocks,
  uploading,
  assetsFolderId,
  onAddFiles,
  onClose,
}: AttachmentsPanelProps) {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("attachments");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachments = blocks
    .filter((b) => b.type === "attachment")
    .map((b) => (b.props ?? {}) as unknown as AttachmentProps)
    .filter((p) => p.name);

  return (
    <div className="w-64 shrink-0 flex flex-col border-l border-[rgba(55,53,47,0.09)] bg-[#fafaf9]">
      {/* ── Header ── */}
      <div className="h-11 flex items-center justify-between px-4 border-b border-[rgba(55,53,47,0.09)] bg-white">
        <span className="text-sm font-medium text-[#37352f]">Anexos</span>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-[rgba(55,53,47,0.08)] text-[#9b9a97] hover:text-[#37352f] transition-colors"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-white border-b border-[rgba(55,53,47,0.09)]">
        {(["attachments", "details"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              "flex-1 py-2 text-xs font-medium transition-colors border-b-2",
              activeTab === tab
                ? "text-[#37352f] border-[#37352f]"
                : "text-[#9b9a97] border-transparent hover:text-[#37352f]",
            ].join(" ")}
          >
            {tab === "attachments" ? "Anexos" : "Detalhes"}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "attachments" ? (
          <div className="p-3 space-y-0.5">
            {attachments.length === 0 && !uploading && (
              <p className="text-xs text-[#9b9a97] text-center py-8">
                Arraste arquivos para o corpo da nota
              </p>
            )}

            {attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-[rgba(55,53,47,0.04)] group">
                <FileTypeMini mimeType={att.mimeType} name={att.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#37352f] truncate leading-tight">{att.name}</p>
                  <p className="text-[11px] text-[#9b9a97]">{formatSize(parseInt(att.size, 10) || 0)}</p>
                </div>
                {att.driveFileId && (
                  <a
                    href={`https://drive.google.com/file/d/${att.driveFileId}/view`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded-md hover:bg-[rgba(55,53,47,0.08)] text-[#9b9a97] opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Abrir no Drive"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}

            {uploading && (
              <div className="flex items-center gap-2 p-2 text-xs text-[#9b9a97]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Enviando...
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <DetailRow label="Criado em"  value={formatPropDate(note.createdAt)} />
            <DetailRow label="Editado em" value={formatPropDate(note.updatedAt)} />
            {session?.user?.name && (
              <DetailRow
                label="Criado por"
                value={session.user.name}
                avatar={session.user.image ?? undefined}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="p-3 border-t border-[rgba(55,53,47,0.09)] bg-white space-y-1.5">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-[#37352f] border border-[rgba(55,53,47,0.16)] rounded-md hover:bg-[rgba(55,53,47,0.04)] transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          Adicionar anexo
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

        {assetsFolderId && (
          <a
            href={`https://drive.google.com/drive/folders/${assetsFolderId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-[#9b9a97] hover:text-[#37352f] transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Abrir pasta no Google Drive
          </a>
        )}
      </div>
    </div>
  );
}

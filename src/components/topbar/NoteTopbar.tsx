"use client";

import { useState, useRef, useEffect } from "react";
import { Download, Share2, Loader2, Cloud, CloudOff, AlertCircle, MoreHorizontal, Check, FileText, Folder, Star, PanelLeft, Paperclip } from "lucide-react";
import { IndexItem } from "@/types";
import { useWorkspace } from "@/lib/workspace-context";

interface NoteTopbarProps {
  noteId: string;
  saveStatus: "saved" | "saving" | "unsaved" | "error";
  attachmentCount?: number;
  attachmentsOpen?: boolean;
  onToggleAttachments?: () => void;
}

const FAVORITES_KEY = "ndg-favorites";

function getFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]"); } catch { return []; }
}

function toggleFavorite(id: string): boolean {
  const favs = getFavorites();
  const idx = favs.indexOf(id);
  if (idx === -1) { favs.push(id); } else { favs.splice(idx, 1); }
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  return idx === -1; // true = now favorited
}

export function NoteTopbar({ noteId, saveStatus, attachmentCount = 0, attachmentsOpen, onToggleAttachments }: NoteTopbarProps) {
  const { index, manifest, sidebarVisible, toggleSidebar } = useWorkspace();
  const [exporting, setExporting] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Sync favorite state when noteId changes
  useEffect(() => {
    setIsFavorited(getFavorites().includes(noteId));
  }, [noteId]);

  const noteItem = index?.items.find((i) => i.id === noteId);

  // Close "more" menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function getBreadcrumb(): { title: string; icon?: string; type: "note" | "folder" }[] {
    if (!noteItem || !index) return [];
    const parts: { title: string; icon?: string; type: "note" | "folder" }[] = [
      { title: noteItem.title || "Sem título", icon: noteItem.icon, type: noteItem.type },
    ];
    let current: IndexItem | undefined = noteItem;
    while (current?.parentId) {
      const parent = index.items.find((i) => i.id === current!.parentId);
      if (!parent) break;
      parts.unshift({ title: parent.title, icon: parent.icon, type: parent.type });
      current = parent;
    }
    return parts;
  }

  async function handleExport() {
    if (!noteItem?.driveFileId || !manifest) return;
    setExporting(true);
    try {
      const res = await fetch(
        `/api/export/${noteId}?driveFileId=${noteItem.driveFileId}`
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${noteItem.title || "nota"}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
      setShowMore(false);
    }
  }

  async function handleCopyLink() {
    if (!manifest) return;
    const url = `https://drive.google.com/drive/folders/${manifest.rootFolderId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowMore(false);
  }

  function handleToggleFavorite() {
    const nowFav = toggleFavorite(noteId);
    setIsFavorited(nowFav);
  }

  const breadcrumb = getBreadcrumb();

  return (
    <div className="h-11 flex items-center px-3 gap-2 bg-white border-b border-[rgba(55,53,47,0.09)]">
      {/* ── Sidebar toggle ── */}
      <button
        onClick={toggleSidebar}
        title={sidebarVisible ? "Ocultar barra lateral" : "Mostrar barra lateral"}
        className="p-1.5 rounded-md hover:bg-[rgba(55,53,47,0.08)] text-[#9b9a97] hover:text-[#37352f] transition-colors shrink-0"
      >
        <PanelLeft className="w-4 h-4" />
      </button>

      {/* ── Breadcrumb ── */}
      <div className="flex-1 flex items-center gap-0.5 text-sm text-[#9b9a97] min-w-0 overflow-hidden">
        {breadcrumb.map((part, i) => (
          <span key={i} className="flex items-center gap-1 min-w-0 shrink-0">
            {i > 0 && (
              <span className="text-[rgba(55,53,47,0.2)] px-1 shrink-0">/</span>
            )}
            {/* Icon: custom emoji > default SVG */}
            <span className="shrink-0 flex items-center">
              {part.icon ? (
                <span className="text-sm leading-none">{part.icon}</span>
              ) : part.type === "folder" ? (
                <Folder className="w-3.5 h-3.5 fill-[#e6a817] text-[#e6a817]" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-[#9b9a97]" />
              )}
            </span>
            <span
              className={cn(
                "ml-1",
                i === breadcrumb.length - 1
                  ? "text-[#37352f] font-medium truncate max-w-[200px]"
                  : "truncate max-w-[120px]"
              )}
            >
              {part.title}
            </span>
          </span>
        ))}
      </div>

      {/* ── Right side ── */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Save status */}
        <div className="flex items-center gap-1.5 text-xs text-[#9b9a97] mr-2">
          {saveStatus === "saving" ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Sincronizando...</span>
            </>
          ) : saveStatus === "saved" ? (
            <>
              <Cloud className="w-3.5 h-3.5" />
              <span>Salvo no Google Drive</span>
            </>
          ) : saveStatus === "error" ? (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-red-500">Erro ao sincronizar</span>
            </>
          ) : (
            <>
              <CloudOff className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-500">Salvo localmente</span>
            </>
          )}
        </div>

        {/* Attachments toggle */}
        {onToggleAttachments && (
          <button
            onClick={onToggleAttachments}
            title={attachmentsOpen ? "Fechar painel de anexos" : "Abrir painel de anexos"}
            className={cn(
              "relative p-1.5 rounded-md transition-colors",
              attachmentsOpen
                ? "bg-[rgba(55,53,47,0.08)] text-[#37352f]"
                : "text-[#9b9a97] hover:text-[#37352f] hover:bg-[rgba(55,53,47,0.08)]",
            )}
          >
            <Paperclip className="w-4 h-4" />
            {attachmentCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-[#37352f] text-white text-[9px] font-medium rounded-full flex items-center justify-center px-[3px] leading-none">
                {attachmentCount}
              </span>
            )}
          </button>
        )}

        {/* Favorite / star button */}
        <button
          onClick={handleToggleFavorite}
          title={isFavorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          className="p-1.5 rounded-md hover:bg-[rgba(55,53,47,0.08)] transition-colors"
        >
          <Star
            className={cn(
              "w-4 h-4 transition-colors",
              isFavorited
                ? "fill-[#e6a817] text-[#e6a817]"
                : "text-[#9b9a97] hover:text-[#37352f]"
            )}
          />
        </button>

        {/* Share button */}
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[rgba(55,53,47,0.16)] text-sm text-[#37352f] hover:bg-[rgba(55,53,47,0.06)] transition-colors ml-1"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-500" />
              <span>Copiado!</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5" />
              <span>Compartilhar</span>
            </>
          )}
        </button>

        {/* ··· More options */}
        <div ref={moreRef} className="relative">
          <button
            onClick={() => setShowMore((v) => !v)}
            className="p-1.5 rounded-md hover:bg-[rgba(55,53,47,0.08)] text-[#9b9a97] hover:text-[#37352f] transition-colors"
            title="Mais opções"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMore && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[rgba(55,53,47,0.12)] py-1 w-52">
              <button
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-[#37352f] hover:bg-[rgba(55,53,47,0.06)]"
                onClick={handleToggleFavorite}
              >
                <Star className={cn("w-3.5 h-3.5", isFavorited ? "fill-[#e6a817] text-[#e6a817]" : "text-gray-400")} />
                {isFavorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              </button>
              <div className="border-t border-[rgba(55,53,47,0.09)] my-1" />
              <button
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-[#37352f] hover:bg-[rgba(55,53,47,0.06)]"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-gray-400" />
                )}
                Exportar Markdown
              </button>
              <button
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-[#37352f] hover:bg-[rgba(55,53,47,0.06)]"
                onClick={handleCopyLink}
              >
                <Share2 className="w-3.5 h-3.5 text-gray-400" />
                Copiar link do Drive
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

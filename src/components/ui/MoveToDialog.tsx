"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Home, Loader2 } from "lucide-react";
import { IndexItem } from "@/types";
import { cn } from "@/lib/utils";

interface MoveToDialogProps {
  itemId: string;
  items: IndexItem[];
  onMove: (targetParentId: string | null) => Promise<void>;
  onClose: () => void;
}

export function MoveToDialog({ itemId, items, onMove, onClose }: MoveToDialogProps) {
  const [selected, setSelected] = useState<string | null | undefined>(undefined);
  const [moving, setMoving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const folders = items.filter(
    (i) => i.type === "folder" && i.id !== itemId && !isDescendantOf(items, i.id, itemId)
  );

  async function handleMove() {
    if (selected === undefined) return;
    setMoving(true);
    try {
      await onMove(selected);
      onClose();
    } finally {
      setMoving(false);
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderFolder(folder: IndexItem, depth: number) {
    const children = folders.filter((f) => f.parentId === folder.id);
    const isOpen = expanded.has(folder.id);
    const isSelected = selected === folder.id;

    return (
      <div key={folder.id}>
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer select-none",
            "hover:bg-gray-100",
            isSelected && "bg-blue-50 text-blue-700"
          )}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => setSelected(folder.id)}
        >
          <button
            className="text-gray-400 w-4"
            onClick={(e) => { e.stopPropagation(); toggleExpand(folder.id); }}
          >
            {children.length > 0 ? (
              isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
            ) : <span className="w-3" />}
          </button>
          {isOpen ? <FolderOpen className="w-4 h-4 text-gray-500 shrink-0" /> : <Folder className="w-4 h-4 text-gray-500 shrink-0" />}
          <span className="text-sm truncate">{folder.icon} {folder.title}</span>
        </div>
        {isOpen && children.map((c) => renderFolder(c, depth + 1))}
      </div>
    );
  }

  const rootFolders = folders.filter((f) => f.parentId === null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="bg-white rounded-xl shadow-2xl w-80 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Mover para...</h3>
        </div>

        <div className="max-h-64 overflow-y-auto p-2">
          {/* Root option */}
          <div
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer",
              "hover:bg-gray-100",
              selected === null && "bg-blue-50 text-blue-700"
            )}
            onClick={() => setSelected(null)}
          >
            <Home className="w-4 h-4 text-gray-500" />
            <span className="text-sm">Raiz (sem pasta)</span>
          </div>

          {rootFolders.map((f) => renderFolder(f, 0))}

          {folders.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              Nenhuma pasta disponível
            </p>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleMove}
            disabled={selected === undefined || moving}
            className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            {moving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Mover"}
          </button>
        </div>
      </div>
    </div>
  );
}

function isDescendantOf(items: IndexItem[], itemId: string, ancestorId: string): boolean {
  const item = items.find((i) => i.id === itemId);
  if (!item || item.parentId === null) return false;
  if (item.parentId === ancestorId) return true;
  return isDescendantOf(items, item.parentId, ancestorId);
}

"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";

// Dynamically import to avoid SSR
const Picker = dynamic(
  () => import("@emoji-mart/react").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="w-[352px] h-[400px] bg-white rounded-xl flex items-center justify-center">
        <span className="text-[#9b9a97] text-sm">Carregando...</span>
      </div>
    ),
  }
);

// ─── Raw EmojiPicker (popover content) ───────────────────────────────────────

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onRemove?: () => void;
}

export function EmojiPicker({ onSelect, onRemove }: EmojiPickerProps) {
  return (
    <div className="bg-white rounded-xl shadow-2xl border border-[rgba(55,53,47,0.12)] overflow-hidden">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Picker
        data={async () => {
          const r = await fetch("https://cdn.jsdelivr.net/npm/@emoji-mart/data");
          return r.json();
        }}
        onEmojiSelect={(e: { native: string }) => onSelect(e.native)}
        locale="pt"
        theme="light"
        previewPosition="none"
        skinTonePosition="none"
        navPosition="bottom"
        perLine={9}
        emojiSize={22}
        emojiButtonSize={30}
        set="native"
      />
      {onRemove && (
        <div className="border-t border-[rgba(55,53,47,0.09)] px-3 py-2">
          <button
            onClick={onRemove}
            className="w-full text-left text-xs text-[#9b9a97] hover:text-[#37352f] hover:bg-[rgba(55,53,47,0.06)] px-2 py-1 rounded transition-colors"
          >
            Remover ícone
          </button>
        </div>
      )}
    </div>
  );
}

// ─── EmojiButton (trigger + floating picker) ──────────────────────────────────

interface EmojiButtonProps {
  emoji?: string;
  onChange: (emoji: string) => void;
  onRemove?: () => void;
  size?: "sm" | "lg";
  /** Rendered when no emoji is set (overrides the built-in 📄/📝 fallback) */
  defaultIcon?: React.ReactNode;
}

export function EmojiButton({
  emoji,
  onChange,
  onRemove,
  size = "sm",
  defaultIcon,
}: EmojiButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const btnClass =
    size === "lg"
      ? "text-4xl w-14 h-14 rounded-xl hover:bg-[rgba(55,53,47,0.08)] flex items-center justify-center transition-colors"
      : "w-full h-full flex items-center justify-center rounded hover:bg-[rgba(55,53,47,0.12)] transition-colors";

  const content = emoji ? (
    <span className={size === "lg" ? "text-4xl" : "text-sm leading-none"}>{emoji}</span>
  ) : defaultIcon ? (
    <>{defaultIcon}</>
  ) : size === "lg" ? (
    <span className="text-4xl">📝</span>
  ) : (
    <span className="text-sm">📄</span>
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={btnClass}
        title="Alterar ícone"
      >
        {content}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-[100]">
          <EmojiPicker
            onSelect={(emoji) => {
              onChange(emoji);
              setOpen(false);
            }}
            onRemove={
              onRemove
                ? () => {
                    onRemove();
                    setOpen(false);
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}

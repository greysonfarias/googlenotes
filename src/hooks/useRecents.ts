"use client";

import { useCallback } from "react";

const STORAGE_KEY = "ndg-recents";
const MAX_RECENTS = 5;
const EVENT_NAME = "ndg-recents-updated";

export interface RecentItem {
  id: string;
  title: string;
  icon?: string;
}

export function useRecents() {
  const getRecents = useCallback((): RecentItem[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as RecentItem[]) : [];
    } catch {
      return [];
    }
  }, []);

  const addRecent = useCallback((item: RecentItem) => {
    if (typeof window === "undefined") return;
    try {
      const prev = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? "[]"
      ) as RecentItem[];
      const next = [item, ...prev.filter((r) => r.id !== item.id)].slice(
        0,
        MAX_RECENTS
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      // Notify all listeners that recents changed
      window.dispatchEvent(new CustomEvent(EVENT_NAME));
    } catch {}
  }, []);

  const subscribeToRecents = useCallback((cb: () => void) => {
    window.addEventListener(EVENT_NAME, cb);
    return () => window.removeEventListener(EVENT_NAME, cb);
  }, []);

  return { getRecents, addRecent, subscribeToRecents };
}

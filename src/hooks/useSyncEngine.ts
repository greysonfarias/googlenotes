"use client";

import { useEffect } from "react";
import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import { syncEngine } from "@/lib/sync-engine";

/**
 * Initialize the Sync Engine in the React tree.
 *
 * - Subscribes to the syncQueue via Dexie liveQuery and triggers a flush
 *   whenever new pending items appear.
 * - Flushes immediately when the tab goes to background (visibilitychange).
 *
 * Mount once in AppShell or app layout.
 */
export function useSyncEngine(): void {
  useEffect(() => {
    // React to new items entering the queue
    const subscription = liveQuery(() =>
      db.syncQueue.where("status").equals("pending").count(),
    ).subscribe((count) => {
      if (count > 0) syncEngine.scheduleFlush();
    });

    // Flush when the tab goes to background
    function onVisibilityChange() {
      if (document.hidden) void syncEngine.flush();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
}

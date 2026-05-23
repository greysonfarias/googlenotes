"use client";

import { useState, useEffect } from "react";
import { liveQuery } from "dexie";
import { db } from "@/lib/db";

export interface SyncStatusResult {
  pending: number;
  errors: number;
  isSyncing: boolean;
}

export function useSyncStatus(): SyncStatusResult {
  const [pending, setPending] = useState(0);
  const [errors, setErrors] = useState(0);

  useEffect(() => {
    const sub1 = liveQuery(() =>
      db.syncQueue.where("status").anyOf(["pending", "syncing"]).count(),
    ).subscribe((count) => setPending(count));

    const sub2 = liveQuery(() =>
      db.syncQueue.where("status").equals("error").count(),
    ).subscribe((count) => setErrors(count));

    return () => {
      sub1.unsubscribe();
      sub2.unsubscribe();
    };
  }, []);

  return { pending, errors, isSyncing: pending > 0 };
}

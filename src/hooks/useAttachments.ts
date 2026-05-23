"use client";

import { useCallback, useState } from "react";
import { useSession } from "next-auth/react";
import { useWorkspace } from "@/lib/workspace-context";
import { Attachment, Note } from "@/types";
import { generateId } from "@/lib/utils";
import { driveUploadFile, driveDeleteFile } from "@/lib/drive-client";

/**
 * Manages attachments for a note.
 *
 * - Uploads go directly to Drive (browser-side, via drive-client).
 * - Attachment metadata is stored in note.attachments[] and persisted via saveNote().
 * - The note state in the parent component is updated immediately via onNoteChange().
 */
export function useAttachments(
  note: Note | null,
  onNoteChange: (updated: Note) => void,
  saveNote: (updated: Note) => Promise<void>,
) {
  const { data: session } = useSession();
  const { manifest } = useWorkspace();
  const [uploading, setUploading] = useState(false);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!session?.accessToken || !manifest || !note) return;

      const token = session.accessToken as string;
      const parentId = manifest.assetsFolderId;

      setUploading(true);
      try {
        const newAttachments: Attachment[] = [];

        for (const file of Array.from(files)) {
          const result = await driveUploadFile(token, file, parentId);
          newAttachments.push({
            id: generateId("att"),
            driveFileId: result.id,
            name: file.name,
            mimeType: result.mimeType || file.type || "application/octet-stream",
            size: result.size ?? file.size,
            addedAt: new Date().toISOString(),
          });
        }

        const updated: Note = {
          ...note,
          attachments: [...(note.attachments ?? []), ...newAttachments],
        };

        // Update UI immediately, then persist
        onNoteChange(updated);
        await saveNote(updated);
      } finally {
        setUploading(false);
      }
    },
    [session, manifest, note, onNoteChange, saveNote],
  );

  const deleteAttachment = useCallback(
    async (attachmentId: string) => {
      if (!note) return;

      const att = note.attachments?.find((a) => a.id === attachmentId);
      if (!att) return;

      // Delete from Drive (best-effort — don't block UI if Drive fails)
      if (session?.accessToken) {
        try {
          await driveDeleteFile(session.accessToken as string, att.driveFileId);
        } catch {
          // ignore — file may already be gone
        }
      }

      const updated: Note = {
        ...note,
        attachments: note.attachments?.filter((a) => a.id !== attachmentId) ?? [],
      };

      onNoteChange(updated);
      await saveNote(updated);
    },
    [session, note, onNoteChange, saveNote],
  );

  return {
    attachments: note?.attachments ?? [],
    uploading,
    uploadFiles,
    deleteAttachment,
  };
}

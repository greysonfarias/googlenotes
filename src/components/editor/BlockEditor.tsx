"use client";

import "@blocknote/mantine/style.css";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { useEffect, useRef } from "react";
import { NoteBlock } from "@/types";
import { AttachmentBlock, AttachmentBlockData, makeAttachmentBlock } from "./AttachmentBlockSpec";

// ─── Custom schema (default blocks + attachment) ──────────────────────────────

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    attachment: AttachmentBlock,
  },
});

// ─── Public API exposed via onEditorReady ─────────────────────────────────────

export interface BlockEditorApi {
  /** Insert one attachment block at/after the current cursor, or at end of doc. */
  insertAttachment: (data: AttachmentBlockData) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BlockEditorProps {
  blocks: NoteBlock[];
  onChange: (blocks: NoteBlock[]) => void;
  editable?: boolean;
  onEditorReady?: (api: BlockEditorApi) => void;
}

export function BlockEditor({
  blocks,
  onChange,
  editable = true,
  onEditorReady,
}: BlockEditorProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = useCreateBlockNote<any, any, any>(
    blocks.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? { schema, initialContent: blocks as any }
      : { schema },
  );

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;

  // Propagate block changes up
  useEffect(() => {
    const unsubscribe = editor.onChange(() => {
      onChangeRef.current(editor.document as unknown as NoteBlock[]);
    });
    return unsubscribe;
  }, [editor]);

  // Expose API to parent after editor is ready
  useEffect(() => {
    if (!onEditorReadyRef.current) return;
    onEditorReadyRef.current({
      insertAttachment(data: AttachmentBlockData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const block = makeAttachmentBlock(data) as any;
        try {
          const cursor = editor.getTextCursorPosition();
          if (cursor?.block) {
            editor.insertBlocks([block], cursor.block, "after");
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const doc = editor.document as any[];
            if (doc.length > 0) {
              editor.insertBlocks([block], doc[doc.length - 1], "after");
            }
          }
        } catch {
          // Fallback: insertBlocks may fail if cursor state is unusual
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const doc = editor.document as any[];
          if (doc.length > 0) {
            editor.insertBlocks([block], doc[doc.length - 1], "after");
          }
        }
      },
    });
  // onEditorReady identity is stable (useRef), editor is stable per note key
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // BlockNoteView from @blocknote/mantine has typing issues with generics in TS5
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const View = BlockNoteView as any;

  return (
    <View
      editor={editor}
      editable={editable}
      theme="light"
      className="min-h-full"
    />
  );
}

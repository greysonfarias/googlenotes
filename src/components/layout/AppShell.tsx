"use client";

import { useEffect } from "react";
import { useState } from "react";
import { NotesTree } from "@/components/sidebar/NotesTree";
import { FolderSidebar } from "@/components/sidebar/FolderSidebar";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace-context";
import { useResizable } from "@/hooks/useResizable";
import { useSyncEngine } from "@/hooks/useSyncEngine";

/** Thin drag handle between panels */
function ResizeHandle({
  onMouseDown,
}: {
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-[5px] shrink-0 cursor-col-resize flex items-stretch z-10"
    >
      <div
        className="w-px flex-1 transition-colors duration-150"
        style={{
          background: hovered
            ? "rgba(35,131,226,0.6)"
            : "rgba(55,53,47,0.09)",
        }}
      />
    </div>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const {
    selectedNoteId,
    activeFolderId,
    setActiveFolderId,
    index,
    sidebarVisible,
  } = useWorkspace();

  // Initialize Sync Engine listeners (liveQuery + visibilitychange)
  useSyncEngine();

  const {
    width: primaryW,
    startResize: startPrimary,
  } = useResizable(280, "ndg-primary-w-v2", { min: 180, max: 400 });

  const {
    width: secondaryW,
    startResize: startSecondary,
  } = useResizable(480, "ndg-secondary-w-v2", { min: 320, max: 720 });

  // When a note is selected, auto-show its parent folder as secondary sidebar.
  useEffect(() => {
    if (selectedNoteId != null && index) {
      const parentId = index.items.find((i) => i.id === selectedNoteId)?.parentId ?? null;
      setActiveFolderId(parentId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNoteId, index]);

  /**
   * Layout modes:
   *
   * folderFullscreen: folder selected, no note open
   *   → FolderSidebar fills the entire main content area (full width)
   *   → No secondary sidebar
   *
   * folderSidebar: folder selected AND a note is open
   *   → FolderSidebar is a resizable secondary sidebar
   *   → Note editor fills the remaining main area
   *
   * Default: no folder selected
   *   → Just the primary sidebar + main content
   */
  const folderFullscreen = activeFolderId !== null && selectedNoteId === null;
  const folderSidebar    = activeFolderId !== null && selectedNoteId !== null;

  return (
    <div className="flex h-screen bg-white overflow-hidden">

      {/* ── Primary sidebar ── */}
      {sidebarVisible && (
        <>
          <aside
            className="shrink-0 flex flex-col overflow-hidden"
            style={{ width: primaryW, background: "#f7f6f5" }}
          >
            <NotesTree />
          </aside>

          <ResizeHandle onMouseDown={startPrimary} />
        </>
      )}

      {/* ── Secondary sidebar — only when a note is also open ── */}
      {folderSidebar && (
        <>
          <aside
            className="shrink-0 flex flex-col overflow-hidden bg-white border-r border-[rgba(55,53,47,0.09)]"
            style={{ width: secondaryW }}
          >
            <FolderSidebar folderId={activeFolderId} />
          </aside>

          <ResizeHandle onMouseDown={startSecondary} />
        </>
      )}

      {/* ── Main content area ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/*
          When a folder is selected but no note is open, show the folder
          contents as a full-width view instead of a cramped sidebar.
          When a note is clicked from there, the layout transitions to
          folderSidebar mode (above) and children becomes the note editor.
        */}
        {folderFullscreen
          ? <FolderSidebar folderId={activeFolderId} fullscreen />
          : children
        }
      </main>
    </div>
  );
}

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <WorkspaceProvider>
      <AppShellInner>{children}</AppShellInner>
    </WorkspaceProvider>
  );
}

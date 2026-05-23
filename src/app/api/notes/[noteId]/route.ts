import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-factory";
import { loadNote, updateNote, deleteNote } from "@/services/notes/notes";
import { Note } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const session = await getServerSession();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const driveFileId = req.nextUrl.searchParams.get("driveFileId");
  if (!driveFileId) {
    return NextResponse.json({ error: "driveFileId obrigatório" }, { status: 400 });
  }

  // Suppress unused warning
  void params;

  try {
    const note = await loadNote(session.accessToken as string, driveFileId);
    return NextResponse.json(note);
  } catch (error) {
    console.error("[notes/[noteId] GET]", error);
    return NextResponse.json({ error: "Falha ao carregar nota" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const session = await getServerSession();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  void params;

  const { note, driveFileId, markdownFolderId, indexFileId } =
    (await req.json()) as {
      note: Note;
      driveFileId: string;
      markdownFolderId: string;
      indexFileId: string;
    };

  try {
    await updateNote(
      session.accessToken as string,
      note,
      driveFileId,
      markdownFolderId,
      indexFileId
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[notes/[noteId] PUT]", error);
    return NextResponse.json({ error: "Falha ao salvar nota" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const session = await getServerSession();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { noteId } = await params;
  const driveFileId = req.nextUrl.searchParams.get("driveFileId");
  const markdownFolderId = req.nextUrl.searchParams.get("markdownFolderId");
  const indexFileId = req.nextUrl.searchParams.get("indexFileId");

  if (!driveFileId || !markdownFolderId || !indexFileId) {
    return NextResponse.json({ error: "Parâmetros obrigatórios ausentes" }, { status: 400 });
  }

  try {
    await deleteNote(
      session.accessToken as string,
      noteId,
      driveFileId,
      markdownFolderId,
      indexFileId
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[notes/[noteId] DELETE]", error);
    return NextResponse.json({ error: "Falha ao deletar nota" }, { status: 500 });
  }
}

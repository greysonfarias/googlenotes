import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-factory";
import { createNote } from "@/services/notes/notes";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { title, parentId, notesFolderId, markdownFolderId, indexFileId, icon } =
    await req.json();

  try {
    const { note, driveFileId } = await createNote(
      session.accessToken as string,
      title || "Sem título",
      parentId ?? null,
      notesFolderId,
      markdownFolderId,
      indexFileId,
      icon
    );
    return NextResponse.json({ ...note, driveFileId });
  } catch (error) {
    console.error("[notes POST]", error);
    return NextResponse.json({ error: "Falha ao criar nota" }, { status: 500 });
  }
}

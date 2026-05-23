import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-factory";
import { createFolder, deleteFolder, renameItem } from "@/services/notes/notes";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { title, parentId, indexFileId } = await req.json();

  try {
    const folderId = await createFolder(
      session.accessToken as string,
      title || "Nova pasta",
      parentId ?? null,
      indexFileId
    );
    return NextResponse.json({ id: folderId, title: title || "Nova pasta", parentId: parentId ?? null });
  } catch (error) {
    console.error("[folders POST]", error);
    return NextResponse.json({ error: "Falha ao criar pasta" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const folderId = req.nextUrl.searchParams.get("folderId");
  const indexFileId = req.nextUrl.searchParams.get("indexFileId");

  if (!folderId || !indexFileId) {
    return NextResponse.json({ error: "Parâmetros obrigatórios ausentes" }, { status: 400 });
  }

  try {
    await deleteFolder(session.accessToken as string, folderId, indexFileId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[folders DELETE]", error);
    return NextResponse.json({ error: "Falha ao deletar pasta" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { itemId, newTitle, indexFileId } = await req.json();

  try {
    await renameItem(session.accessToken as string, itemId, newTitle, indexFileId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[folders PATCH]", error);
    return NextResponse.json({ error: "Falha ao renomear" }, { status: 500 });
  }
}


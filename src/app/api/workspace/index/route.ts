import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-factory";
import { loadIndex, updateIndex } from "@/services/notes/workspace";
import { NoteIndex } from "@/types";

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const indexFileId = req.nextUrl.searchParams.get("indexFileId");
  if (!indexFileId) {
    return NextResponse.json({ error: "indexFileId obrigatório" }, { status: 400 });
  }

  try {
    const index = await loadIndex(session.accessToken as string, indexFileId);
    return NextResponse.json(index);
  } catch (error) {
    console.error("[workspace/index GET]", error);
    return NextResponse.json({ error: "Falha ao carregar index" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { indexFileId, index } = (await req.json()) as {
    indexFileId: string;
    index: NoteIndex;
  };

  try {
    await updateIndex(session.accessToken as string, indexFileId, index);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[workspace/index PUT]", error);
    return NextResponse.json({ error: "Falha ao atualizar index" }, { status: 500 });
  }
}


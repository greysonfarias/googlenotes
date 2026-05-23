import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-factory";
import { moveItem, updateItemMeta } from "@/services/notes/notes";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { itemId, newParentId, indexFileId } = await req.json();

  try {
    await moveItem(session.accessToken as string, itemId, newParentId ?? null, indexFileId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[items/move]", error);
    return NextResponse.json({ error: "Falha ao mover item" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { itemId, icon, description, indexFileId } = await req.json();

  const updates: { icon?: string; description?: string } = {};
  if (icon !== undefined) updates.icon = icon;
  if (description !== undefined) updates.description = description;

  try {
    await updateItemMeta(session.accessToken as string, itemId, updates, indexFileId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[items/meta]", error);
    return NextResponse.json({ error: "Falha ao atualizar item" }, { status: 500 });
  }
}

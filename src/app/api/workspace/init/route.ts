import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-factory";
import { initializeWorkspace } from "@/services/notes/workspace";
import { loadIndex } from "@/services/notes/workspace";

export async function GET() {
  const session = await getServerSession();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const manifest = await initializeWorkspace(session.accessToken as string);
    const index = await loadIndex(
      session.accessToken as string,
      manifest.indexFileId
    );
    return NextResponse.json({ manifest, index });
  } catch (error) {
    console.error("[workspace/init]", error);
    return NextResponse.json(
      { error: "Falha ao inicializar workspace" },
      { status: 500 }
    );
  }
}


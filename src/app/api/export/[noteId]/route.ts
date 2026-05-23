import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-factory";
import { exportNoteToMarkdown } from "@/services/notes/notes";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const session = await getServerSession();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const driveFileId = req.nextUrl.searchParams.get("driveFileId");
  const { noteId } = await params;

  if (!driveFileId) {
    return NextResponse.json({ error: "driveFileId obrigatório" }, { status: 400 });
  }

  try {
    const markdown = await exportNoteToMarkdown(
      session.accessToken as string,
      driveFileId
    );

    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${noteId}.md"`,
      },
    });
  } catch (error) {
    console.error("[export/[noteId]]", error);
    return NextResponse.json({ error: "Falha ao exportar nota" }, { status: 500 });
  }
}

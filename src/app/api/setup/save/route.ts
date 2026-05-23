import { NextRequest, NextResponse } from "next/server";
import { saveConfig } from "@/lib/config.server";

export async function POST(req: NextRequest) {
  const { googleClientId, googleClientSecret } = await req.json();

  if (!googleClientId?.trim() || !googleClientSecret?.trim()) {
    return NextResponse.json(
      { error: "Client ID e Client Secret são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    saveConfig(googleClientId.trim(), googleClientSecret.trim());
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[setup/save]", error);
    return NextResponse.json(
      { error: "Falha ao salvar configuração" },
      { status: 500 }
    );
  }
}

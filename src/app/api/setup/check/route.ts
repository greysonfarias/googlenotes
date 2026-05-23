import { NextResponse } from "next/server";
import { readConfig } from "@/lib/config.server";

export async function GET() {
  const config = readConfig();
  return NextResponse.json({ configured: config.configured });
}

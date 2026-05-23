import { createNextAuth } from "@/lib/auth-factory";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { handlers } = createNextAuth();
  return handlers.GET(req);
}

export async function POST(req: NextRequest) {
  const { handlers } = createNextAuth();
  return handlers.POST(req);
}

import { NextResponse } from "next/server";
import { defaultProviderId, providerOptions } from "@/lib/ai";

export const dynamic = "force-dynamic";

/** GET /api/ai/providers — the AI backends + which are configured (for the selector). */
export async function GET() {
  return NextResponse.json({ providers: providerOptions(), default: defaultProviderId });
}

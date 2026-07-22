import { type NextRequest, NextResponse } from "next/server";
import { getEntityByCode } from "@/lib/grantops/store";
import { listEntityKnowledge } from "@/lib/grantops/knowledge";
import { isGoogleConfigured } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/grantops/knowledge?entity=CODE — the entity's Drive knowledge folder and
 * its files. Powers the per-entity knowledge panel on the Entities page. Returns
 * connected:false (never an error) when Google isn't configured/authorized, so the
 * panel degrades gracefully.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("entity");
  if (!code) return NextResponse.json({ error: "entity required" }, { status: 400 });

  const entity = getEntityByCode(code);
  if (!entity) return NextResponse.json({ error: "unknown entity" }, { status: 404 });

  if (!isGoogleConfigured()) {
    return NextResponse.json({ configured: false, connected: false, files: [] });
  }
  try {
    const listing = await listEntityKnowledge(entity);
    return NextResponse.json({ configured: true, ...listing });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

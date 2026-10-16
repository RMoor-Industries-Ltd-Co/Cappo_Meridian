import { type NextRequest, NextResponse } from "next/server";
import { isAgentAuthorized } from "@/lib/agentAuth";
import { runProductSync } from "@/lib/productSync";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Manual/on-demand trigger for the Notion ↔ Shopify governed-product
 * reconciliation (same x-agent-key pattern as /api/lexicon/sync). There is
 * no scheduled/automatic version of this yet — see Phase 2 scope in the PR
 * description; this endpoint is the only way to run it in Phase 1, so a
 * sync never happens unattended.
 */
export async function POST(req: NextRequest) {
  if (!isAgentAuthorized(req.headers.get("x-agent-key"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runProductSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

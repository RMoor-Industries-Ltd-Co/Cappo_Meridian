import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { syncLexiconFromNotion } from "@/lib/lexiconSync";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Manual/on-demand trigger for the same Notion → Lexicon sync the daily scheduler
 * runs (see lib/lexiconScheduler.ts). Shares the AGENT_API_KEY auth pattern used by
 * /api/agent — this is a machine/admin action, not part of the human dashboard login.
 */
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-agent-key");
  if (!env.AGENT_API_KEY || key !== env.AGENT_API_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncLexiconFromNotion();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

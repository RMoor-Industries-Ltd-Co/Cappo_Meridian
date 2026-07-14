import { type NextRequest, NextResponse } from "next/server";
import { isAgentAuthorized } from "@/lib/agentAuth";
import { runCappoAgent } from "@/lib/agent";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Machine-to-machine delegation endpoint. ALLIE (allen.i.verse) calls this with the
 * shared AGENT_API_KEY to delegate an AMG task to Cappo, who executes it and replies.
 * Auth here is the key — separate from the human Google login that gates the dashboard.
 */
export async function POST(req: NextRequest) {
  if (!isAgentAuthorized(req.headers.get("x-agent-key"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { task?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const task = (body.task ?? "").toString().trim();
  if (!task) return NextResponse.json({ error: "task required" }, { status: 400 });
  try {
    const reply = await runCappoAgent(task);
    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

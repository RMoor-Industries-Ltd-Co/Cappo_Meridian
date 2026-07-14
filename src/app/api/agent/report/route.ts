import { type NextRequest, NextResponse } from "next/server";
import { isAgentAuthorized } from "@/lib/agentAuth";
import { getLastSuccessfulCappoReport } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Pull-only: returns Cappo's latest cached executive report (generated on a schedule by
 * cappoReportScheduler.ts), instantly — no live agent call. Distinct from POST /api/agent,
 * which does live task delegation. Same auth as that endpoint (shared AGENT_API_KEY).
 */
export async function GET(req: NextRequest) {
  if (!isAgentAuthorized(req.headers.get("x-agent-key"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const last = await getLastSuccessfulCappoReport();
  if (!last) {
    return NextResponse.json({ report_text: null, generated_at: null, error: "no report generated yet" });
  }
  return NextResponse.json(last);
}

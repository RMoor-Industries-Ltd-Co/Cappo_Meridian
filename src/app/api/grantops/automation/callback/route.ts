import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { isAgentAuthorized } from "@/lib/agentAuth";
import { updateApplication } from "@/lib/grantops/store";

export const runtime = "nodejs";

/**
 * Make.com callback: after the approval webhook builds a grant's Drive folder + draft
 * docs, Make POSTs the folder URL back here so Cappo links it onto the application.
 *
 * Authed with the same shared AGENT_API_KEY (x-agent-key) as /api/agent — this is an
 * internal M2M surface, never hit by a browser. Best-effort by design: if the app
 * record is gone (Cappo's store resets on redeploy), we still 200 — the Drive folder
 * is already the durable record, so a lost link is a cosmetic miss, not a failure.
 */
export async function POST(req: NextRequest) {
  if (!isAgentAuthorized(req.headers.get("x-agent-key"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { applicationId?: string; driveFolderUrl?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore malformed body — handled below */
  }

  const applicationId = (body.applicationId ?? "").toString().trim();
  const driveFolderUrl = (body.driveFolderUrl ?? "").toString().trim();
  if (!applicationId || !driveFolderUrl) {
    return NextResponse.json(
      { error: "applicationId and driveFolderUrl required" },
      { status: 400 },
    );
  }

  const updated = updateApplication(applicationId, { driveFolderUrl });
  if (updated) revalidatePath(`/grantops/applications/${applicationId}`);

  // 200 even when the record is absent — see the header comment (durable record is Drive).
  return NextResponse.json({ ok: true, linked: Boolean(updated) });
}

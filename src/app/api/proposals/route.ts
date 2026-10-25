import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAuthConfigured } from "@/lib/env";
import { groupByTab, isProposalsConfigured, listProposals, submitProposal } from "@/lib/connectors/proposals";

export const dynamic = "force-dynamic";

/**
 * This repo's sitewide `middleware.ts` already redirects an unauthenticated
 * browser request to /signin before it reaches here. This explicit check is
 * defense in depth at the route-handler level itself — it returns a proper
 * 401 JSON response (rather than relying on a redirect a non-browser caller
 * might not follow) and is directly unit-testable without simulating
 * Next.js middleware. Like the rest of the app, it only engages once auth
 * is actually configured — unconfigured stays browsable, same as the
 * middleware's own fallback.
 */
async function requireSession(): Promise<boolean> {
  if (!isAuthConfigured()) return true;
  const session = await auth();
  return Boolean(session?.user);
}

/** GET /api/proposals — all proposals, pre-grouped into Overview/Ideas/Reviewed tabs. */
export async function GET() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isProposalsConfigured()) {
    return NextResponse.json({ configured: false, tabs: { overview: [], ideas: [], reviewed: [] } });
  }
  try {
    const proposals = await listProposals();
    return NextResponse.json({ configured: true, tabs: groupByTab(proposals) });
  } catch (err) {
    return NextResponse.json(
      { configured: true, error: err instanceof Error ? err.message : String(err), tabs: { overview: [], ideas: [], reviewed: [] } },
      { status: 502 },
    );
  }
}

/** POST /api/proposals — New Proposal intake. Defaults to Inbox/Not Reviewed/Pending. */
export async function POST(req: NextRequest) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isProposalsConfigured()) {
    return NextResponse.json({ error: "Notion not connected" }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    type?: string;
    brandId?: string;
    domainId?: string;
    notes?: string;
    submittedBy?: string;
    sourcePage?: string;
    driveLink?: string;
    reviewOwner?: string;
  };
  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  try {
    // submitProposal coalesces concurrent same-title requests in this
    // process and checks for a just-created duplicate before writing —
    // see its own doc comment for what this does and doesn't guarantee.
    const { proposal, duplicate } = await submitProposal({
      title,
      type: body.type as never,
      brandId: body.brandId || undefined,
      domainId: body.domainId || undefined,
      notes: body.notes || undefined,
      submittedBy: body.submittedBy || undefined,
      sourcePage: body.sourcePage || undefined,
      driveLink: body.driveLink || undefined,
      reviewOwner: body.reviewOwner || undefined,
    });
    return NextResponse.json({ ok: true, proposal, duplicate });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

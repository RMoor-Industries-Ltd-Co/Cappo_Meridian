import { type NextRequest, NextResponse } from "next/server";
import {
  createProposal,
  findRecentDuplicateTitle,
  groupByTab,
  isProposalsConfigured,
  listProposals,
} from "@/lib/connectors/proposals";

export const dynamic = "force-dynamic";

/** GET /api/proposals — all proposals, pre-grouped into Overview/Ideas/Reviewed tabs. */
export async function GET() {
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
    const dup = await findRecentDuplicateTitle(title);
    if (dup) {
      return NextResponse.json({ ok: true, proposal: dup, duplicate: true });
    }

    const proposal = await createProposal({
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
    return NextResponse.json({ ok: true, proposal, duplicate: false });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

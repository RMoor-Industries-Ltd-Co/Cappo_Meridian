import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAuthConfigured } from "@/lib/env";
import { isProposalsConfigured, updateProposalReview } from "@/lib/connectors/proposals";
import type { Decision, ReviewStatus } from "@/lib/connectors/proposals";

export const dynamic = "force-dynamic";

const REVIEW_STATUSES: ReviewStatus[] = ["Not Reviewed", "In Review", "Reviewed"];
const DECISIONS: Decision[] = ["Pending", "Approved Direction", "Revision Requested", "Deferred", "Rejected"];

/** See the sibling /api/proposals route's doc comment on `requireSession`. */
async function requireSession(): Promise<boolean> {
  if (!isAuthConfigured()) return true;
  const session = await auth();
  return Boolean(session?.user);
}

/**
 * PATCH /api/proposals/[id] — persist a review outcome. Updating the
 * Review Status / Decision here moves the record to the correct tab on
 * the next read; this endpoint never touches anything outside Notion's
 * Capture/Ideas record itself (no merge/deploy/spend side effect — see
 * `updateProposalReview`'s own doc comment on the governance rule this
 * enforces).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isProposalsConfigured()) {
    return NextResponse.json({ error: "Notion not connected" }, { status: 503 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    reviewStatus?: string;
    decision?: string;
    decisionRationale?: string;
    reviewOwner?: string;
  };

  if (body.reviewStatus !== undefined && !REVIEW_STATUSES.includes(body.reviewStatus as ReviewStatus)) {
    return NextResponse.json({ error: "invalid reviewStatus" }, { status: 400 });
  }
  if (body.decision !== undefined && !DECISIONS.includes(body.decision as Decision)) {
    return NextResponse.json({ error: "invalid decision" }, { status: 400 });
  }

  try {
    await updateProposalReview(id, {
      reviewStatus: body.reviewStatus as ReviewStatus | undefined,
      decision: body.decision as Decision | undefined,
      decisionRationale: body.decisionRationale,
      reviewOwner: body.reviewOwner,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

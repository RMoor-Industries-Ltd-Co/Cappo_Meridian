import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { env, isAuthConfigured } from "@/lib/env";
import { previewDigest, runDigest } from "@/lib/meetings/digest";
import { isNotConnected } from "@/lib/connectors/driveFs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/meetings/digest — compose the daily board digest.
 *
 * `{ "preview": true }` composes and returns it without persisting or sending;
 * that is how the /meetings page renders a draft for review. Without it, the
 * digest is claimed and mailed — idempotent per calendar day.
 */
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-agent-key");
  const machine = Boolean(env.AGENT_API_KEY) && key === env.AGENT_API_KEY;
  if (!machine && isAuthConfigured()) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);

  try {
    if (body.preview) {
      const p = await previewDigest();
      return NextResponse.json(p ?? { empty: true });
    }
    // The scheduled caller respects the kill switch; a partner pressing "Send"
    // in the UI has already made the decision explicitly.
    if (machine && env.DIGEST_ENABLED !== "true") {
      return NextResponse.json({ status: "disabled" });
    }
    return NextResponse.json(await runDigest());
  } catch (err) {
    if (isNotConnected(err)) {
      return NextResponse.json({ error: "Google not connected" }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

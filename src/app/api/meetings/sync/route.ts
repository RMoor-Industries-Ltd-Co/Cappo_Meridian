import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { env, isAuthConfigured } from "@/lib/env";
import { ingestMeetings } from "@/lib/meetings/ingest";
import { analyzePending } from "@/lib/meetings/analyze";
import { isNotConnected } from "@/lib/connectors/driveFs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/meetings/sync — ingest new meeting transcripts, then analyze them
 * into the initiative registry.
 *
 * Callable two ways: by a signed-in partner from the /meetings page, or
 * machine-to-machine with AGENT_API_KEY (how the nightly cron drives it).
 */
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-agent-key");
  const machine = Boolean(env.AGENT_API_KEY) && key === env.AGENT_API_KEY;
  if (!machine && isAuthConfigured()) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const lookbackDays = Number(body.lookbackDays) || undefined;
  const analyze = body.analyze !== false;

  try {
    const ingest = await ingestMeetings(lookbackDays);
    const analysis = analyze ? await analyzePending(10) : null;
    return NextResponse.json({ ingest, analysis });
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

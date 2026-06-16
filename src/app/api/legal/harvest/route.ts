import { NextResponse } from "next/server";
import { harvestSignedDocs } from "@/lib/legalHarvest";
import { isNotConnected } from "@/lib/connectors/driveFs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /api/legal/harvest — file signed-copy PDFs from email into Drive (Gmail → Drive). */
export async function POST() {
  try {
    const result = await harvestSignedDocs();
    return NextResponse.json(result);
  } catch (err) {
    if (isNotConnected(err)) {
      return NextResponse.json({ error: "Google not connected" }, { status: 409 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getTagOptions, isWikiConfigured } from "@/lib/connectors/notionWiki";

export const dynamic = "force-dynamic";

/** GET /api/wiki/options — Brand + Domain choices for entry-form selects. */
export async function GET() {
  if (!isWikiConfigured()) return NextResponse.json({ brands: [], domains: [] });
  try {
    return NextResponse.json(await getTagOptions());
  } catch {
    return NextResponse.json({ brands: [], domains: [] });
  }
}

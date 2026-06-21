import { NextResponse } from "next/server";
import { getLexiconTerms } from "@/lib/connectors/lexicon";
import { env } from "@/lib/env";

export const revalidate = 3600; // cache for 1 hour

export async function GET() {
  if (!env.NOTION_API_KEY) {
    return NextResponse.json({ configured: false, terms: [] });
  }
  try {
    const terms = await getLexiconTerms();
    return NextResponse.json({ configured: true, terms });
  } catch (err) {
    return NextResponse.json(
      { configured: true, terms: [], error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

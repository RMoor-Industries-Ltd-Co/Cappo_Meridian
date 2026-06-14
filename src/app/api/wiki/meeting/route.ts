import { type NextRequest, NextResponse } from "next/server";
import { createMeetingNote, isWikiConfigured } from "@/lib/connectors/notionWiki";

export const dynamic = "force-dynamic";

/**
 * POST /api/wiki/meeting — add a Meeting Notes row.
 * { title, date?, source?, link?, summary?, domainId?, brandId? }.
 */
export async function POST(req: NextRequest) {
  if (!isWikiConfigured()) {
    return NextResponse.json({ error: "Notion not connected" }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    date?: string;
    source?: string;
    link?: string;
    summary?: string;
    domainId?: string;
    brandId?: string;
  };
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  try {
    await createMeetingNote({
      title: body.title.trim(),
      date: body.date || undefined,
      source: body.source || undefined,
      link: body.link || undefined,
      summary: body.summary || undefined,
      domainId: body.domainId || undefined,
      brandId: body.brandId || undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

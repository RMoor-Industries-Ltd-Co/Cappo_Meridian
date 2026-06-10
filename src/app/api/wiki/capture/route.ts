import { type NextRequest, NextResponse } from "next/server";
import { createCapture, isWikiConfigured } from "@/lib/connectors/notionWiki";

export const dynamic = "force-dynamic";

/** POST /api/wiki/capture — add a Capture/Ideas entry. { title, type?, domainId?, brandId?, notes? }. */
export async function POST(req: NextRequest) {
  if (!isWikiConfigured()) {
    return NextResponse.json({ error: "Notion not connected" }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    type?: string;
    domainId?: string;
    brandId?: string;
    notes?: string;
  };
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  try {
    await createCapture({
      title: body.title.trim(),
      type: body.type,
      domainId: body.domainId || undefined,
      brandId: body.brandId || undefined,
      notes: body.notes,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

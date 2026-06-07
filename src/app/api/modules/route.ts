import { type NextRequest, NextResponse } from "next/server";
import { getConnector } from "@/lib/connectors";
import { clickupTasksByTag } from "@/lib/connectors/clickup";

export const dynamic = "force-dynamic";

/** GET /api/modules?tag=<tag> — AMG ClickUp tasks tagged for a function module. */
export async function GET(req: NextRequest) {
  const tag = req.nextUrl.searchParams.get("tag")?.trim();
  if (!tag) return NextResponse.json({ error: "tag required" }, { status: 400 });

  const clickup = getConnector("clickup");
  if (!clickup?.isConfigured()) {
    return NextResponse.json({ configured: false, tasks: [] });
  }
  try {
    const tasks = await clickupTasksByTag(tag);
    return NextResponse.json({ configured: true, tasks });
  } catch (err) {
    return NextResponse.json(
      { configured: true, tasks: [], error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

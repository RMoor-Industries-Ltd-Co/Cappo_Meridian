import { type NextRequest, NextResponse } from "next/server";
import { getConnector } from "@/lib/connectors";
import { clickupCreateTask, clickupTasksByTag } from "@/lib/connectors/clickup";

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

/** POST /api/modules — create a ClickUp task. { name, tag?, due? (ISO date) }. */
export async function POST(req: NextRequest) {
  const clickup = getConnector("clickup");
  if (!clickup?.isConfigured()) {
    return NextResponse.json({ error: "ClickUp not connected" }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    tag?: string;
    due?: string;
  };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const dueMs = body.due ? new Date(`${body.due}T12:00:00`).getTime() : null;
  try {
    const task = await clickupCreateTask({
      name: body.name.trim(),
      tag: body.tag?.trim() || undefined,
      dueMs: Number.isFinite(dueMs) ? dueMs : null,
    });
    return NextResponse.json({ task });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

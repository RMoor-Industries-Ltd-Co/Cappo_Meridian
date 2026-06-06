import { type NextRequest, NextResponse } from "next/server";
import { getConnector } from "@/lib/connectors";
import { clickupCalendarEvents } from "@/lib/connectors/clickup";

export const dynamic = "force-dynamic";

/**
 * Calendar events for [start, end] (ms epoch query params), sourced from the
 * ClickUp AMG space. Returns { configured:false } when ClickUp isn't set up so
 * the UI can fall back to a sample schedule.
 */
export async function GET(req: NextRequest) {
  const clickup = getConnector("clickup");
  if (!clickup?.isConfigured()) {
    return NextResponse.json({ configured: false, events: [] });
  }

  const start = Number(req.nextUrl.searchParams.get("start"));
  const end = Number(req.nextUrl.searchParams.get("end"));
  if (!start || !end) {
    return NextResponse.json({ error: "start and end (ms) required" }, { status: 400 });
  }

  try {
    const events = await clickupCalendarEvents(start, end);
    return NextResponse.json({ configured: true, events });
  } catch (err) {
    return NextResponse.json({
      configured: true,
      events: [],
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

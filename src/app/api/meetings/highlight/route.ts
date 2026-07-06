import { type NextRequest, NextResponse } from "next/server";
import { domainsForPath } from "@/lib/domainMap";
import { getHighestPriorityForDomains } from "@/lib/meetingHighlight";

export const dynamic = "force-dynamic";

/**
 * GET /api/meetings/highlight?path=/campaigns — the top open item for whatever
 * Notion Domain(s) the given nav path maps to. Powers the Meetings nav item's
 * hover highlight (see components/shell/MeetingHighlight.tsx).
 */
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path") ?? "/";
  const domains = domainsForPath(path);
  if (domains.length === 0) {
    return NextResponse.json({ highlight: null });
  }
  try {
    const highlight = await getHighestPriorityForDomains(domains);
    return NextResponse.json({ highlight });
  } catch (err) {
    return NextResponse.json(
      { highlight: null, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

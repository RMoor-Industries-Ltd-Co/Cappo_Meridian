import { type NextRequest, NextResponse } from "next/server";
import { getConnector } from "@/lib/connectors";
import { clickupAmgBoard, clickupSetStatus } from "@/lib/connectors/clickup";
import {
  getAmgStructure,
  getCaptureInbox,
  getMeetingNotes,
  getRecentActions,
  getRecentDecisions,
  isWikiConfigured,
} from "@/lib/connectors/notionWiki";

export const dynamic = "force-dynamic";

/**
 * GET /api/operations — the Operations panel payload: AMG structure + recent
 * wiki records from Notion, plus the current ClickUp swim-lane board.
 */
export async function GET() {
  const clickup = getConnector("clickup");
  const clickupConfigured = Boolean(clickup?.isConfigured());
  const notionConfigured = isWikiConfigured();

  const [board, structure, meetings, captures, decisions, actions] = await Promise.all([
    clickupConfigured
      ? clickupAmgBoard().catch(() => ({ tasks: [], statuses: [] }))
      : Promise.resolve({ tasks: [], statuses: [] }),
    notionConfigured ? getAmgStructure().catch(() => ({ units: [], domains: [] })) : Promise.resolve({ units: [], domains: [] }),
    notionConfigured ? getMeetingNotes(8).catch(() => []) : Promise.resolve([]),
    notionConfigured ? getCaptureInbox(8).catch(() => []) : Promise.resolve([]),
    notionConfigured ? getRecentDecisions(6).catch(() => []) : Promise.resolve([]),
    notionConfigured ? getRecentActions(6).catch(() => []) : Promise.resolve([]),
  ]);

  return NextResponse.json({
    clickupConfigured,
    notionConfigured,
    board,
    structure,
    meetings,
    captures,
    decisions,
    actions,
  });
}

/** POST /api/operations — move a ClickUp task to a new status. { taskId, status }. */
export async function POST(req: NextRequest) {
  const clickup = getConnector("clickup");
  if (!clickup?.isConfigured()) {
    return NextResponse.json({ error: "ClickUp not connected" }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as { taskId?: string; status?: string };
  if (!body.taskId || !body.status) {
    return NextResponse.json({ error: "taskId and status required" }, { status: 400 });
  }
  try {
    await clickupSetStatus(body.taskId, body.status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

import { type NextRequest, NextResponse } from "next/server";
import { getConnector } from "@/lib/connectors";
import { clickupTasksByTag } from "@/lib/connectors/clickup";
import { getDomainBundle, isWikiConfigured } from "@/lib/connectors/notionWiki";

export const dynamic = "force-dynamic";

/**
 * GET /api/domain?name=<Domain> — a function module's live view: AMG ClickUp
 * tasks tagged for it + Notion wiki records tagged with that Domain.
 */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const clickup = getConnector("clickup");
  const clickupConfigured = Boolean(clickup?.isConfigured());
  const notionConfigured = isWikiConfigured();
  const tag = name.toLowerCase();

  const [tasks, bundle] = await Promise.all([
    clickupConfigured ? clickupTasksByTag(tag).catch(() => []) : Promise.resolve([]),
    notionConfigured
      ? getDomainBundle(name).catch(() => ({ catalog: [], documents: [], decisions: [], actions: [], captures: [], glossary: [] }))
      : Promise.resolve({ catalog: [], documents: [], decisions: [], actions: [], captures: [], glossary: [] }),
  ]);

  return NextResponse.json({ domain: name, tag, clickupConfigured, notionConfigured, tasks, bundle });
}

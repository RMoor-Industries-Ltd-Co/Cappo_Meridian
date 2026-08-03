import { Client } from "@notionhq/client";
import { env } from "@/lib/env";
import { NOTION_DS } from "@/lib/notionSchema";
import type { DirectRecord } from "./types";

/**
 * Notion meeting content, read through the Notion API rather than Gmail.
 *
 * WHY THIS IS DIFFERENT FROM GEMINI/FATHOM. Those two announce themselves by
 * email and carry (or link to) their transcript, so Gmail is a workable front
 * door. Notion's notification emails are a LINK and nothing more — following
 * them is impossible under a Google-only integration, which is why the earlier
 * email-based Notion source produced stubs. Notion holds the actual notes in a
 * database, so this reads that database directly and the stub problem
 * disappears.
 */

let client: Client | null = null;
function getClient(): Client {
  if (!env.NOTION_API_KEY) throw new Error("NOTION_API_KEY not set");
  if (!client) client = new Client({ auth: env.NOTION_API_KEY });
  return client;
}

export function isNotionSourceConfigured(): boolean {
  return Boolean(env.NOTION_API_KEY);
}

interface NProp {
  title?: { plain_text: string }[];
  rich_text?: { plain_text: string }[];
  select?: { name: string } | null;
  date?: { start: string | null } | null;
  url?: string | null;
}
interface NRow {
  id: string;
  url?: string;
  created_time?: string;
  properties: Record<string, NProp>;
}

const plain = (rt?: { plain_text: string }[]) => (rt ?? []).map((t) => t.plain_text).join("");

/**
 * Block types whose text is worth keeping. Notion pages carry a lot of
 * structural noise; transcripts live in paragraphs, list items, headings, and
 * quotes.
 */
const TEXT_BLOCKS = new Set([
  "paragraph",
  "heading_1",
  "heading_2",
  "heading_3",
  "bulleted_list_item",
  "numbered_list_item",
  "quote",
  "callout",
  "toggle",
  "to_do",
  "code",
]);

interface Block {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
}

/**
 * Flatten a page's blocks into plain text.
 *
 * Depth-limited and budgeted: a meeting page can nest toggles several levels
 * deep, and an unbounded walk over a large workspace turns one ingest into
 * thousands of API calls. Truncation is preferable to a run that never
 * finishes — and the head of a transcript is what extraction needs anyway.
 */
async function pageText(pageId: string, maxChars = 60_000, depth = 0): Promise<string> {
  if (depth > 2) return "";
  const out: string[] = [];
  let cursor: string | undefined;
  let total = 0;

  do {
    const res = await getClient().blocks.children.list({
      block_id: pageId,
      page_size: 100,
      start_cursor: cursor,
    });
    for (const raw of res.results as unknown as Block[]) {
      if (!TEXT_BLOCKS.has(raw.type)) continue;
      const payload = raw[raw.type] as { rich_text?: { plain_text: string }[] } | undefined;
      const text = plain(payload?.rich_text).trim();
      if (text) {
        out.push(text);
        total += text.length;
        if (total >= maxChars) return out.join("\n");
      }
      if (raw.has_children) {
        const nested = await pageText(raw.id, maxChars - total, depth + 1);
        if (nested) {
          out.push(nested);
          total += nested.length;
          if (total >= maxChars) return out.join("\n");
        }
      }
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return out.join("\n");
}

/**
 * Pull recent meeting rows and their page bodies.
 *
 * Rows whose Source names another service are SKIPPED: the Notion meetings
 * database is an index across all four services, so a row describing a Fathom
 * recording would otherwise be filed as if Notion had recorded it, and the same
 * meeting would be counted twice.
 */
export async function fetchNotionMeetings(limit = 50): Promise<DirectRecord[]> {
  if (!isNotionSourceConfigured()) return [];

  const res = await getClient().dataSources.query({
    data_source_id: NOTION_DS.meetings,
    page_size: Math.min(limit, 100),
    sorts: [{ property: "Date", direction: "descending" }],
  } as Parameters<Client["dataSources"]["query"]>[0]);

  const rows = res.results as unknown as NRow[];
  const out: DirectRecord[] = [];

  for (const r of rows) {
    const source = (r.properties.Source?.select?.name ?? "").toLowerCase();
    if (source && source !== "notion") continue;

    const title = plain(r.properties.Title?.title) || "Untitled meeting";
    const summary = plain(r.properties.Summary?.rich_text);
    const date = r.properties.Date?.date?.start ?? r.created_time ?? null;

    let body = "";
    try {
      body = await pageText(r.id);
    } catch {
      // A page the integration can't read still contributes its summary rather
      // than dropping the meeting entirely.
    }

    const combined = [summary, body].filter(Boolean).join("\n\n").trim();
    if (!combined) continue;

    out.push({
      source: "notion",
      externalId: r.id,
      title,
      occurredAt: date,
      body: combined,
      link: r.url ?? null,
    });
  }
  return out;
}

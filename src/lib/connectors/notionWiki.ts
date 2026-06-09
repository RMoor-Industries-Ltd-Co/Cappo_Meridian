import { Client } from "@notionhq/client";
import { env } from "@/lib/env";
import { NOTION_DS } from "@/lib/notionSchema";

/**
 * Read helpers for the AMG Partner Hub wiki (Notion API 2025-09-03 / data sources).
 * Powers the Operations panel: org structure, meeting notes, and recent records.
 */

interface NProp {
  type?: string;
  title?: { plain_text: string }[];
  rich_text?: { plain_text: string }[];
  select?: { name: string } | null;
  date?: { start: string | null } | null;
  url?: string | null;
  relation?: { id: string }[];
}
interface NRow {
  id: string;
  url?: string;
  properties: Record<string, NProp>;
}

let client: Client | null = null;
function getClient(): Client {
  if (!env.NOTION_API_KEY) throw new Error("NOTION_API_KEY not set");
  if (!client) client = new Client({ auth: env.NOTION_API_KEY });
  return client;
}

export function isWikiConfigured(): boolean {
  return Boolean(env.NOTION_API_KEY);
}

const plain = (rt?: { plain_text: string }[]) => (rt ?? []).map((t) => t.plain_text).join("");
const titleOf = (r: NRow, key: string) => plain(r.properties[key]?.title);
const textOf = (r: NRow, key: string) => plain(r.properties[key]?.rich_text);
const selOf = (r: NRow, key: string) => r.properties[key]?.select?.name ?? "";
const dateOf = (r: NRow, key: string) => r.properties[key]?.date?.start ?? null;
const urlOf = (r: NRow, key: string) => r.properties[key]?.url ?? null;
const relOf = (r: NRow, key: string) => r.properties[key]?.relation ?? [];

async function query(
  dataSourceId: string,
  opts: {
    page_size?: number;
    sorts?: { property: string; direction: "ascending" | "descending" }[];
  } = {},
): Promise<NRow[]> {
  const res = await getClient().dataSources.query({
    data_source_id: dataSourceId,
    page_size: opts.page_size ?? 50,
    ...(opts.sorts ? { sorts: opts.sorts } : {}),
  });
  return res.results as unknown as NRow[];
}

export interface OrgUnit {
  id: string;
  name: string;
  type: string;
  status: string;
  parentId: string | null;
}

/** The AMG ownership tree (Business Units & Brands) + the Domain list. */
export async function getAmgStructure(): Promise<{ units: OrgUnit[]; domains: string[] }> {
  const [bu, dom] = await Promise.all([
    query(NOTION_DS.bu, { page_size: 100 }),
    query(NOTION_DS.domains, { page_size: 100 }),
  ]);
  const units = bu.map((r) => ({
    id: r.id,
    name: titleOf(r, "Name"),
    type: selOf(r, "Type"),
    status: selOf(r, "Status"),
    parentId: relOf(r, "Parent")[0]?.id ?? null,
  }));
  const domains = dom.map((r) => titleOf(r, "Name")).filter(Boolean);
  return { units, domains };
}

export interface MeetingNote {
  id: string;
  title: string;
  date: string | null;
  source: string;
  link: string | null;
  summary: string;
  url: string;
}

/** Recent meeting notes — the single index across Fathom / Gemini / ClickUp / Notion. */
export async function getMeetingNotes(limit = 8): Promise<MeetingNote[]> {
  const rows = await query(NOTION_DS.meetings, {
    page_size: limit,
    sorts: [{ property: "Date", direction: "descending" }],
  });
  return rows.map((r) => ({
    id: r.id,
    title: titleOf(r, "Title") || "Untitled",
    date: dateOf(r, "Date"),
    source: selOf(r, "Source"),
    link: urlOf(r, "Source Link"),
    summary: textOf(r, "Summary"),
    url: r.url ?? "",
  }));
}

export interface WikiItem {
  id: string;
  title: string;
  meta: string;
  url: string;
}

export async function getCaptureInbox(limit = 8): Promise<WikiItem[]> {
  const rows = await query(NOTION_DS.capture, { page_size: limit });
  return rows.map((r) => ({
    id: r.id,
    title: titleOf(r, "Title") || "Untitled",
    meta: [selOf(r, "Type"), selOf(r, "Status")].filter(Boolean).join(" · "),
    url: r.url ?? "",
  }));
}

export async function getRecentDecisions(limit = 6): Promise<WikiItem[]> {
  const rows = await query(NOTION_DS.decisions, { page_size: limit });
  return rows.map((r) => ({
    id: r.id,
    title: titleOf(r, "Decision") || "Untitled",
    meta: [selOf(r, "Status"), dateOf(r, "Date") ?? ""].filter(Boolean).join(" · "),
    url: r.url ?? "",
  }));
}

export async function getRecentActions(limit = 6): Promise<WikiItem[]> {
  const rows = await query(NOTION_DS.actions, { page_size: limit });
  return rows.map((r) => ({
    id: r.id,
    title: titleOf(r, "Action") || "Untitled",
    meta: [selOf(r, "Status"), textOf(r, "Owner")].filter(Boolean).join(" · "),
    url: r.url ?? "",
  }));
}

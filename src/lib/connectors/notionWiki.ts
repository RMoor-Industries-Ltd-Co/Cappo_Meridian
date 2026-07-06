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

type QueryArgs = Parameters<Client["dataSources"]["query"]>[0];

async function query(
  dataSourceId: string,
  opts: {
    page_size?: number;
    sorts?: { property: string; direction: "ascending" | "descending" }[];
    filter?: Record<string, unknown>;
  } = {},
): Promise<NRow[]> {
  const args: Record<string, unknown> = {
    data_source_id: dataSourceId,
    page_size: opts.page_size ?? 50,
  };
  if (opts.sorts) args.sorts = opts.sorts;
  if (opts.filter) args.filter = opts.filter;
  const res = await getClient().dataSources.query(args as QueryArgs);
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

const meetingRow = (r: NRow): MeetingNote => ({
  id: r.id,
  title: titleOf(r, "Title") || "Untitled",
  date: dateOf(r, "Date"),
  source: selOf(r, "Source"),
  link: urlOf(r, "Source Link"),
  summary: textOf(r, "Summary"),
  url: r.url ?? "",
});

/** Recent meeting notes — the single index across Fathom / Gemini / ClickUp / Notion. */
export async function getMeetingNotes(limit = 8): Promise<MeetingNote[]> {
  const rows = await query(NOTION_DS.meetings, {
    page_size: limit,
    sorts: [{ property: "Date", direction: "descending" }],
  });
  return rows.map(meetingRow);
}

/** Most recent meeting notes tagged with a given Domain (see getDomainBundle). */
export async function getMeetingNotesByDomain(domainName: string, limit = 5): Promise<MeetingNote[]> {
  const dom = await query(NOTION_DS.domains, { page_size: 100 });
  const d = dom.find((r) => titleOf(r, "Name").toLowerCase() === domainName.toLowerCase());
  if (!d) return [];
  const rows = await query(NOTION_DS.meetings, {
    page_size: limit,
    sorts: [{ property: "Date", direction: "descending" }],
    filter: { property: "Domain", relation: { contains: d.id } },
  });
  return rows.map(meetingRow);
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

export interface TagOption { id: string; name: string }

/** Brand + Domain options for entry-form selects (relation targets). */
export async function getTagOptions(): Promise<{ brands: TagOption[]; domains: TagOption[] }> {
  const [bu, dom] = await Promise.all([
    query(NOTION_DS.bu, { page_size: 100 }),
    query(NOTION_DS.domains, { page_size: 100 }),
  ]);
  return {
    brands: bu.map((r) => ({ id: r.id, name: titleOf(r, "Name") })).filter((x) => x.name),
    domains: dom.map((r) => ({ id: r.id, name: titleOf(r, "Name") })).filter((x) => x.name),
  };
}

export interface DomainBundle {
  catalog: WikiItem[];
  documents: WikiItem[];
  decisions: WikiItem[];
  actions: WikiItem[];
  captures: WikiItem[];
  glossary: WikiItem[];
}

/** All wiki records tagged with a given Domain — the cross-tool view for a module. */
export async function getDomainBundle(domainName: string): Promise<DomainBundle> {
  const empty: DomainBundle = { catalog: [], documents: [], decisions: [], actions: [], captures: [], glossary: [] };
  const dom = await query(NOTION_DS.domains, { page_size: 100 });
  const d = dom.find((r) => titleOf(r, "Name").toLowerCase() === domainName.toLowerCase());
  if (!d) return empty;

  const f = { filter: { property: "Domain", relation: { contains: d.id } }, page_size: 12 };
  const [catalog, documents, decisions, actions, captures, glossary] = await Promise.all([
    query(NOTION_DS.catalog, f),
    query(NOTION_DS.documents, f),
    query(NOTION_DS.decisions, f),
    query(NOTION_DS.actions, f),
    query(NOTION_DS.capture, f),
    query(NOTION_DS.glossary, f),
  ]);
  const item = (r: NRow, titleKey: string, meta = ""): WikiItem => ({
    id: r.id,
    title: titleOf(r, titleKey) || "Untitled",
    meta,
    url: r.url ?? "",
  });
  return {
    catalog: catalog.map((r) => item(r, "Name", [selOf(r, "Category"), selOf(r, "Status")].filter(Boolean).join(" · "))),
    documents: documents.map((r) => item(r, "Title", selOf(r, "Doc Type"))),
    decisions: decisions.map((r) => item(r, "Decision", selOf(r, "Status"))),
    actions: actions.map((r) => item(r, "Action", selOf(r, "Status"))),
    captures: captures.map((r) => item(r, "Title", [selOf(r, "Type"), selOf(r, "Status")].filter(Boolean).join(" · "))),
    glossary: glossary.map((r) => item(r, "Term")),
  };
}

type CreateArgs = Parameters<Client["pages"]["create"]>[0];

/** Create a Capture / Ideas inbox entry (the dashboard "+ New Entry" target). */
export async function createCapture(input: {
  title: string;
  type?: string;
  domainId?: string;
  brandId?: string;
  notes?: string;
}): Promise<void> {
  const props: Record<string, unknown> = {
    Title: { title: [{ text: { content: input.title } }] },
    Status: { select: { name: "Inbox" } },
  };
  if (input.type) props.Type = { select: { name: input.type } };
  if (input.domainId) props.Domain = { relation: [{ id: input.domainId }] };
  if (input.brandId) props.Brand = { relation: [{ id: input.brandId }] };
  if (input.notes) props.Notes = { rich_text: [{ text: { content: input.notes } }] };
  await getClient().pages.create({
    parent: { type: "data_source_id", data_source_id: NOTION_DS.capture },
    properties: props,
  } as CreateArgs);
}

/** Create a Meeting Notes row (single index across Fathom / Gemini / ClickUp / Notion). */
export async function createMeetingNote(input: {
  title: string;
  date?: string;
  source?: string;
  link?: string;
  summary?: string;
  domainId?: string;
  brandId?: string;
}): Promise<void> {
  const props: Record<string, unknown> = {
    Title: { title: [{ text: { content: input.title } }] },
  };
  if (input.date) props.Date = { date: { start: input.date } };
  if (input.source) props.Source = { select: { name: input.source } };
  if (input.link) props["Source Link"] = { url: input.link };
  if (input.summary) props.Summary = { rich_text: [{ text: { content: input.summary } }] };
  if (input.domainId) props.Domain = { relation: [{ id: input.domainId }] };
  if (input.brandId) props.Brand = { relation: [{ id: input.brandId }] };
  await getClient().pages.create({
    parent: { type: "data_source_id", data_source_id: NOTION_DS.meetings },
    properties: props,
  } as CreateArgs);
}

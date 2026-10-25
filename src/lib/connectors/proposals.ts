import { Client } from "@notionhq/client";
import { env } from "@/lib/env";
import { NOTION_DS } from "@/lib/notionSchema";

/**
 * Proposals — governed intake, review, and decision tracking over the
 * existing Notion "Capture / Ideas" database (`NOTION_DS.capture`,
 * `collection://d934f89f-09e6-4358-8b69-42fc185fcda6`). This is the sole
 * authority for proposal records; no second datastore is introduced here.
 *
 * The governance fields this module reads/writes (Review Status, Decision,
 * Decision Rationale, Submitted By, Review Owner, Source Page, Drive Link)
 * already exist on the live Notion schema — confirmed by fetching the data
 * source directly before writing this file. Property names below are
 * copied verbatim from that schema.
 */

export type ReviewStatus = "Not Reviewed" | "In Review" | "Reviewed" | "";
export type Decision =
  | "Pending"
  | "Approved Direction"
  | "Revision Requested"
  | "Deferred"
  | "Rejected"
  | "";
export type CaptureStatus = "Inbox" | "Triaged" | "Promoted" | "Parked" | "";
export type CaptureType = "Idea" | "Product" | "Terminology" | "Task" | "Document" | "";

export interface Proposal {
  notionId: string;
  url: string;
  title: string;
  type: CaptureType;
  status: CaptureStatus;
  reviewStatus: ReviewStatus;
  decision: Decision;
  decisionRationale: string;
  submittedBy: string;
  reviewOwner: string;
  sourcePage: string | null;
  driveLink: string | null;
  notes: string;
  brandIds: string[];
  domainIds: string[];
  relatedInitiativeIds: string[];
  /** Notion's system-managed creation timestamp — always present, used for duplicate detection. */
  created: string | null;
  /** The manually-entered "Created" date property, if anyone filled it in. Display only; never relied on for dedupe since it's frequently blank. */
  createdManual: string | null;
}

type RichTextToken = { plain_text: string };
export interface NProp {
  type?: string;
  title?: RichTextToken[];
  rich_text?: RichTextToken[];
  select?: { name: string } | null;
  date?: { start: string | null } | null;
  url?: string | null;
  relation?: { id: string }[];
}
export interface NRow {
  id: string;
  url?: string;
  /** Notion's own system-managed creation timestamp — always present, never manually editable. */
  created_time?: string;
  properties: Record<string, NProp>;
}

let client: Client | null = null;
function getClient(): Client {
  if (!env.NOTION_API_KEY) throw new Error("NOTION_API_KEY not set");
  if (!client) client = new Client({ auth: env.NOTION_API_KEY });
  return client;
}

export function isProposalsConfigured(): boolean {
  return Boolean(env.NOTION_API_KEY);
}

const plain = (rt?: RichTextToken[]) => (rt ?? []).map((t) => t.plain_text).join("");
const titleOf = (r: NRow, key: string) => plain(r.properties[key]?.title);
const textOf = (r: NRow, key: string) => plain(r.properties[key]?.rich_text);
const selOf = (r: NRow, key: string) => r.properties[key]?.select?.name ?? "";
const dateOf = (r: NRow, key: string) => r.properties[key]?.date?.start ?? null;
const urlOf = (r: NRow, key: string) => r.properties[key]?.url ?? null;
const relOf = (r: NRow, key: string) => (r.properties[key]?.relation ?? []).map((x) => x.id);

/** Maps a raw Notion row to a typed Proposal — never fabricates a missing value. */
export function mapProposal(r: NRow): Proposal {
  return {
    notionId: r.id,
    url: r.url ?? "",
    title: titleOf(r, "Title"),
    type: (selOf(r, "Type") || "") as CaptureType,
    status: (selOf(r, "Status") || "") as CaptureStatus,
    reviewStatus: (selOf(r, "Review Status") || "") as ReviewStatus,
    decision: (selOf(r, "Decision") || "") as Decision,
    decisionRationale: textOf(r, "Decision Rationale"),
    submittedBy: textOf(r, "Submitted By"),
    reviewOwner: textOf(r, "Review Owner"),
    sourcePage: urlOf(r, "Source Page"),
    driveLink: urlOf(r, "Drive Link"),
    notes: textOf(r, "Notes"),
    brandIds: relOf(r, "Brand"),
    domainIds: relOf(r, "Domain"),
    relatedInitiativeIds: relOf(r, "Related Initiative"),
    // Notion's system `created_time`, not the manual "Created" date property
    // (that one's blank on plenty of real rows — a manually-entered field
    // is never a reliable timestamp to dedupe against). Kept separately
    // below as `createdManual` so nothing already relying on the manual
    // field for display loses it.
    created: r.created_time ?? null,
    createdManual: dateOf(r, "Created"),
  };
}

type QueryArgs = Parameters<Client["dataSources"]["query"]>[0];

/** Fetch every row in the Capture/Ideas data source, handling cursor pagination. */
async function listAllRows(): Promise<NRow[]> {
  const results: NRow[] = [];
  let cursor: string | undefined;
  do {
    const res = await getClient().dataSources.query({
      data_source_id: NOTION_DS.capture,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    } as QueryArgs);
    results.push(...(res.results as unknown as NRow[]));
    cursor = res.next_cursor ?? undefined;
  } while (cursor);
  return results;
}

/** Every proposal record, mapped and unfiltered — tab categorization happens client-side. */
export async function listProposals(): Promise<Proposal[]> {
  const rows = await listAllRows();
  return rows.map(mapProposal);
}

/**
 * Review Status tab assignment. Every proposal lands in exactly one tab:
 * - `In Review` → formal review in progress.
 * - `Reviewed` → a documented decision exists.
 * - anything else (explicitly "Not Reviewed", or simply unset/empty — the
 *   legacy-record case) → Ideas. This mirrors the directive's filter
 *   `Review Status = Not Reviewed OR Review Status is empty`.
 */
export type ProposalTab = "overview" | "ideas" | "reviewed";
export function tabFor(p: Proposal): ProposalTab {
  if (p.reviewStatus === "In Review") return "overview";
  if (p.reviewStatus === "Reviewed") return "reviewed";
  return "ideas";
}

export interface ProposalTabs {
  overview: Proposal[];
  ideas: Proposal[];
  reviewed: Proposal[];
}

export function groupByTab(proposals: Proposal[]): ProposalTabs {
  const tabs: ProposalTabs = { overview: [], ideas: [], reviewed: [] };
  for (const p of proposals) tabs[tabFor(p)].push(p);
  return tabs;
}

type CreateArgs = Parameters<Client["pages"]["create"]>[0];
type UpdateArgs = Parameters<Client["pages"]["update"]>[0];

export interface NewProposalInput {
  title: string;
  type?: CaptureType;
  brandId?: string;
  domainId?: string;
  notes?: string;
  submittedBy?: string;
  sourcePage?: string;
  driveLink?: string;
  reviewOwner?: string;
}

/**
 * Create a new proposal. Defaults, per the directive: Status=Inbox,
 * Review Status=Not Reviewed, Decision=Pending — never left blank, so a
 * fresh submission is unambiguously classified into the Ideas tab.
 */
export async function createProposal(input: NewProposalInput): Promise<Proposal> {
  const title = input.title.trim();
  if (!title) throw new Error("title required");

  const props: Record<string, unknown> = {
    Title: { title: [{ text: { content: title } }] },
    Status: { select: { name: "Inbox" } },
    "Review Status": { select: { name: "Not Reviewed" } },
    Decision: { select: { name: "Pending" } },
  };
  if (input.type) props.Type = { select: { name: input.type } };
  if (input.brandId) props.Brand = { relation: [{ id: input.brandId }] };
  if (input.domainId) props.Domain = { relation: [{ id: input.domainId }] };
  if (input.notes) props.Notes = { rich_text: [{ text: { content: input.notes } }] };
  if (input.submittedBy) props["Submitted By"] = { rich_text: [{ text: { content: input.submittedBy } }] };
  if (input.sourcePage) props["Source Page"] = { url: input.sourcePage };
  if (input.driveLink) props["Drive Link"] = { url: input.driveLink };
  if (input.reviewOwner) props["Review Owner"] = { rich_text: [{ text: { content: input.reviewOwner } }] };

  const page = await getClient().pages.create({
    parent: { type: "data_source_id", data_source_id: NOTION_DS.capture },
    properties: props,
  } as CreateArgs);
  return mapProposal(page as unknown as NRow);
}

/**
 * Best-effort duplicate guard: a retried submission (double-click, network
 * retry) within the window re-sends an identical title. Notion has no
 * unique constraint to lean on, so this checks recent same-title records
 * before creating — "prevent duplicate submissions where feasible," not a
 * hard guarantee. Keyed off Notion's own `created_time` (always present,
 * system-managed) rather than the manually-entered "Created" date property,
 * which is blank on plenty of real rows and would silently skip them.
 *
 * Known limitations of title+time matching (documented, not solved here):
 * - Two *different*, independently-submitted proposals that happen to
 *   share an exact title within the window read as the same "duplicate" —
 *   this guard cannot distinguish "same submission, retried" from
 *   "coincidentally identical wording." It trades a rare false positive
 *   (a legitimate second submission is silently treated as the first)
 *   for the much more common case it's built for (an accidental retry).
 * - The match is case-insensitive and whitespace-trimmed only — it is not
 *   a fuzzy match, so "Financial Review" and "Financial  Review." (extra
 *   space, trailing period) are treated as different titles and both get
 *   created.
 * - The window is wall-clock, scanning every row each call (`listAllRows`)
 *   — fine at this database's current size, but it re-reads the whole
 *   data source on every submission; it does not scale to a very large
 *   Capture/Ideas database without a real index.
 * - A legitimate resubmission of the same title *after* the window simply
 *   creates a second record, same as any other Capture/Ideas entry today.
 * See `submitProposal` below for the concurrent-request case this alone
 * doesn't cover.
 */
export async function findRecentDuplicateTitle(
  title: string,
  withinMs = 2 * 60_000,
): Promise<Proposal | null> {
  const needle = title.trim().toLowerCase();
  if (!needle) return null;
  const rows = await listAllRows();
  const now = Date.now();
  for (const r of rows) {
    const p = mapProposal(r);
    if (p.title.trim().toLowerCase() !== needle) continue;
    if (!p.created) continue;
    const createdAt = new Date(p.created).getTime();
    if (Number.isNaN(createdAt)) continue;
    if (now - createdAt <= withinMs) return p;
  }
  return null;
}

/**
 * In-flight request coalescing, keyed by normalized title: a second
 * `submitProposal` call for the same title while the first is still
 * writing to Notion awaits that same in-flight result instead of racing
 * it with its own `findRecentDuplicateTitle` read (which can't see a write
 * that hasn't landed yet). This closes the concurrent-double-click gap
 * within one server process/instance.
 *
 * Limitation (documented, not solved): this is process-local. Two
 * near-simultaneous requests landing on two different server instances —
 * e.g. two app-server replicas behind a load balancer, or two people
 * submitting the identical title within the same couple of seconds —
 * are not coalesced by this map; `findRecentDuplicateTitle`'s
 * recent-record read is the only cross-process guard, and it only sees a
 * duplicate that has already finished writing. A hard guarantee would
 * need a database-level unique constraint, which Notion does not offer
 * on this property.
 */
const inFlightSubmissions = new Map<string, Promise<{ proposal: Proposal; duplicate: boolean }>>();

export async function submitProposal(
  input: NewProposalInput,
): Promise<{ proposal: Proposal; duplicate: boolean }> {
  const title = input.title.trim();
  if (!title) throw new Error("title required");
  const key = title.toLowerCase();

  const inFlight = inFlightSubmissions.get(key);
  if (inFlight) return inFlight;

  const task = (async () => {
    const dup = await findRecentDuplicateTitle(title);
    if (dup) return { proposal: dup, duplicate: true };
    const proposal = await createProposal(input);
    return { proposal, duplicate: false };
  })();

  inFlightSubmissions.set(key, task);
  try {
    return await task;
  } finally {
    inFlightSubmissions.delete(key);
  }
}

export interface ReviewUpdateInput {
  reviewStatus?: ReviewStatus;
  decision?: Decision;
  decisionRationale?: string;
  reviewOwner?: string;
}

/**
 * Governance rule (per directive §4): `Approved Direction` records Founder
 * alignment on a proposal's direction only. It does not authorize
 * development, merging, deployment, spending, or publication — those each
 * require their own separate approval. This function only ever persists
 * the review fields themselves; it has no side effect on any other system.
 */
export async function updateProposalReview(
  notionId: string,
  input: ReviewUpdateInput,
): Promise<void> {
  const props: Record<string, unknown> = {};
  if (input.reviewStatus !== undefined) {
    props["Review Status"] = input.reviewStatus ? { select: { name: input.reviewStatus } } : { select: null };
  }
  if (input.decision !== undefined) {
    props.Decision = input.decision ? { select: { name: input.decision } } : { select: null };
  }
  if (input.decisionRationale !== undefined) {
    props["Decision Rationale"] = { rich_text: [{ text: { content: input.decisionRationale } }] };
  }
  if (input.reviewOwner !== undefined) {
    props["Review Owner"] = { rich_text: [{ text: { content: input.reviewOwner } }] };
  }
  if (Object.keys(props).length === 0) return;
  await getClient().pages.update({
    page_id: notionId,
    properties: props,
  } as UpdateArgs);
}

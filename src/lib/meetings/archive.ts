import { Readable } from "node:stream";
import { google, type drive_v3 } from "googleapis";
import { env } from "@/lib/env";
import { getArchiveClient } from "@/lib/connectors/google";
import {
  ensureSpreadsheet,
  ensureTabs,
  readTab,
  upsertByKey,
  type Row,
} from "@/lib/connectors/sheets";
import { CATEGORIES, sanitizeCategory, transcriptFilename } from "./naming";

/**
 * The meeting archive on Google Drive — the system of record.
 *
 *     <archive folder>/
 *       Meeting Database          ← the spreadsheet
 *       Gemini/   GROWTH_20260715_140000-150000.txt
 *       Fathom/   GROWTH_20260715_140000-150000.txt
 *       Notion/   …
 *       ClickUp/  …
 *
 * A meeting recorded by several services keeps a file under EACH of them — the
 * archive stays complete — while the spreadsheet holds one row per meeting
 * naming which of those files was the one analyzed. Complete archive, deduped
 * analysis.
 *
 * Postgres caches the live working set for fast reads and can be rebuilt from
 * this folder at any time; nothing here depends on the database.
 */

/**
 * The AMG meeting archive folder. Committed as a default the same way the legal
 * source folders are in `driveFs.ts` — a folder id is an identifier, not a
 * credential — while staying overridable per environment.
 */
export const ARCHIVE_FOLDER_ID =
  env.MEETING_ARCHIVE_FOLDER_ID || "1_C9Mnn78_IoRgycvajLOIrt_IOJAD-Gs";

export const SPREADSHEET_NAME = "Meeting Database";

/** Service folders. Order is also the analysis preference — see SOURCE_RANK. */
export const SERVICE_FOLDERS = ["Gemini", "Fathom", "Notion", "ClickUp"] as const;
export type Service = (typeof SERVICE_FOLDERS)[number];

/** Lowercase source id (as used by the ingest layer) → folder name. */
export const SERVICE_BY_SOURCE: Record<string, Service> = {
  gemini: "Gemini",
  fathom: "Fathom",
  notion: "Notion",
  clickup: "ClickUp",
};

const FOLDER_MIME = "application/vnd.google-apps.folder";

// ── Tabs ────────────────────────────────────────────────────────────

export const TAB_DATABASE = "Database";
export const TAB_DATAHOUSE = "Datahouse";
export const TAB_HISTORICAL = "Historical";
export const TAB_CATEGORIES = "Categories";
export const TAB_STATE = "_state";

export const ALL_TABS = [
  TAB_DATABASE,
  TAB_DATAHOUSE,
  TAB_HISTORICAL,
  TAB_CATEGORIES,
  TAB_STATE,
] as const;

/**
 * One row per meeting. Column A is the meeting key — the upsert identity.
 *
 * `dedup_key` (normalized title + date) is carried alongside it because the two
 * answer different questions. The meeting key is the archive's filename and can
 * acquire a collision suffix; the dedup key is the content identity that says
 * "these two notification emails describe the same meeting". Storing both is
 * what makes re-ingestion idempotent: a meeting already archived is found by
 * its dedup key and reuses its existing meeting key rather than computing a
 * fresh one and appending a duplicate.
 */
export const DATABASE_HEADERS = [
  "key",
  "dedup_key",
  "date",
  "start",
  "end",
  "duration_known",
  "category",
  "title",
  "attendees",
  "sources",
  "analyzed_source",
  "brief",
  "ingested_at",
] as const;

/**
 * One row per initiative-mention. Column A is `slug|meeting_key`, so the same
 * initiative discussed in six meetings is six traceable rows, not six
 * near-duplicate initiatives.
 */
export const DATAHOUSE_HEADERS = [
  "id",
  "slug",
  "title",
  "summary",
  "horizon",
  "status",
  "owner",
  "meeting_key",
  "meeting_date",
  "excerpt",
  "change_note",
  "recorded_at",
] as const;

export const HISTORICAL_HEADERS = [
  "period",
  "category",
  "meetings",
  "initiatives_opened",
  "initiatives_closed",
  "narrative",
  "generated_at",
] as const;

// ── Drive plumbing (archive account) ────────────────────────────────

class NotConnectedError extends Error {
  constructor() {
    super("Google account not connected — authorize the archive account");
    this.name = "NotConnectedError";
  }
}

export function isNotConnected(err: unknown): boolean {
  return err instanceof NotConnectedError;
}

async function drive(): Promise<drive_v3.Drive> {
  const auth = await getArchiveClient();
  if (!auth) throw new NotConnectedError();
  return google.drive({ version: "v3", auth });
}

/** Escape a value for embedding in a Drive `q` string literal. */
function q(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function ensureFolder(name: string, parentId: string): Promise<string> {
  const d = await drive();
  const { data } = await d.files.list({
    q: `name = '${q(name)}' and mimeType = '${FOLDER_MIME}' and '${parentId}' in parents and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const found = data.files?.[0]?.id;
  if (found) return found;
  const created = await d.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new Error(`Failed to create folder "${name}"`);
  return created.data.id;
}

export interface ArchiveHandle {
  rootId: string;
  spreadsheetId: string;
  serviceFolders: Record<Service, string>;
}

let cached: ArchiveHandle | null = null;

/**
 * Resolve (creating if needed) the whole archive structure. Cached per process:
 * the folder layout doesn't change between calls, and re-resolving it would add
 * a Drive round-trip to every single write.
 */
export async function openArchive(rootId: string = ARCHIVE_FOLDER_ID): Promise<ArchiveHandle> {
  if (cached && cached.rootId === rootId) return cached;

  const serviceFolders = {} as Record<Service, string>;
  for (const name of SERVICE_FOLDERS) {
    serviceFolders[name] = await ensureFolder(name, rootId);
  }

  const spreadsheetId = await ensureSpreadsheet(SPREADSHEET_NAME, rootId);
  await ensureTabs(spreadsheetId, ALL_TABS);

  cached = { rootId, spreadsheetId, serviceFolders };
  return cached;
}

/** Drop the cached handle (tests, or after the archive folder is repointed). */
export function resetArchiveCache(): void {
  cached = null;
}

// ── Transcript files ────────────────────────────────────────────────

/**
 * Keys already present in a service folder.
 *
 * Used both for collision detection (two different meetings wanting the same
 * key) and for resumability (a backfill re-run must not rewrite what it already
 * wrote). Paginates: a multi-year archive exceeds one page.
 */
export async function listArchivedKeys(service: Service, rootId?: string): Promise<Set<string>> {
  const handle = await openArchive(rootId);
  const d = await drive();
  const keys = new Set<string>();
  let pageToken: string | undefined;
  do {
    const { data } = await d.files.list({
      q: `'${handle.serviceFolders[service]}' in parents and trashed = false`,
      fields: "nextPageToken, files(name)",
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of data.files ?? []) {
      if (f.name) keys.add(f.name.replace(/\.txt$/i, ""));
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
  return keys;
}

/**
 * Write a transcript into its service folder.
 *
 * Skips silently when the file already exists, which is what makes the backfill
 * safely resumable — an interrupted run re-processes its last window without
 * duplicating anything.
 */
export async function writeTranscript(
  service: Service,
  key: string,
  body: string,
  rootId?: string,
): Promise<{ written: boolean; fileId: string }> {
  const handle = await openArchive(rootId);
  const parent = handle.serviceFolders[service];
  const name = transcriptFilename(key);
  const d = await drive();

  const existing = await d.files.list({
    q: `name = '${q(name)}' and '${parent}' in parents and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const found = existing.data.files?.[0]?.id;
  if (found) return { written: false, fileId: found };

  const created = await d.files.create({
    requestBody: { name, parents: [parent] },
    media: { mimeType: "text/plain", body: Readable.from(Buffer.from(body, "utf8")) },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new Error(`Failed to write transcript ${name}`);
  return { written: true, fileId: created.data.id };
}

/**
 * Read a transcript back out of the archive. Returns null when that service
 * holds no file for the key, so callers can fall back to another source rather
 * than treating a gap as an error.
 */
export async function readTranscript(
  service: Service,
  key: string,
  rootId?: string,
): Promise<string | null> {
  const handle = await openArchive(rootId);
  const d = await drive();
  const { data } = await d.files.list({
    q: `name = '${q(transcriptFilename(key))}' and '${handle.serviceFolders[service]}' in parents and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const fileId = data.files?.[0]?.id;
  if (!fileId) return null;
  const res = await d.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "text" });
  return typeof res.data === "string" ? res.data : String(res.data ?? "");
}

/** Record a meeting's brief on its Database row once analysis has produced one. */
export async function writeBrief(key: string, brief: string, rootId?: string): Promise<void> {
  const handle = await openArchive(rootId);
  const rows = await readTab(handle.spreadsheetId, TAB_DATABASE);
  const header = rows[0] ?? [];
  const briefCol = header.indexOf("brief");
  const existing = rows.slice(1).find((r) => r[0] === key);
  if (!existing || briefCol < 0) return;
  const updated = [...existing];
  updated[briefCol] = brief;
  await upsertByKey(handle.spreadsheetId, TAB_DATABASE, DATABASE_HEADERS, [updated as Row]);
}

// ── Spreadsheet rows ────────────────────────────────────────────────

/**
 * Index of what the archive already holds.
 *
 * `byDedup` maps content identity → the meeting key already assigned to it, so
 * a re-run reuses that key. `allKeys` is every key in use, so a genuinely new
 * meeting landing on an occupied key can be given a suffix instead of
 * overwriting one.
 */
export interface KeyIndex {
  byDedup: Map<string, string>;
  allKeys: Set<string>;
}

export async function loadKeyIndex(rootId?: string): Promise<KeyIndex> {
  const handle = await openArchive(rootId);
  const rows = await readTab(handle.spreadsheetId, TAB_DATABASE);
  const byDedup = new Map<string, string>();
  const allKeys = new Set<string>();
  for (const r of rows.slice(1)) {
    const key = r[0];
    const dedup = r[1];
    if (!key) continue;
    allKeys.add(key);
    if (dedup && !byDedup.has(dedup)) byDedup.set(dedup, key);
  }
  return { byDedup, allKeys };
}

export interface DatabaseRow {
  key: string;
  dedupKey: string;
  date: string;
  start: string;
  end: string;
  durationKnown: boolean;
  category: string;
  title: string;
  attendees: string[];
  /** Services that produced a transcript file for this meeting. */
  sources: string[];
  analyzedSource: string;
  brief: string;
}

export async function upsertDatabaseRows(rows: DatabaseRow[], rootId?: string) {
  const handle = await openArchive(rootId);
  const now = new Date().toISOString();
  const values: Row[] = rows.map((r) => [
    r.key,
    r.dedupKey,
    r.date,
    r.start,
    r.end,
    r.durationKnown,
    r.category,
    r.title,
    r.attendees.join(", "),
    r.sources.join(", "),
    r.analyzedSource,
    r.brief,
    now,
  ]);
  return upsertByKey(handle.spreadsheetId, TAB_DATABASE, DATABASE_HEADERS, values);
}

export interface DatahouseRow {
  slug: string;
  title: string;
  summary: string;
  horizon: string;
  status: string;
  owner: string;
  meetingKey: string;
  meetingDate: string;
  excerpt: string;
  changeNote: string;
}

export async function upsertDatahouseRows(rows: DatahouseRow[], rootId?: string) {
  const handle = await openArchive(rootId);
  const now = new Date().toISOString();
  const values: Row[] = rows.map((r) => [
    `${r.slug}|${r.meetingKey}`,
    r.slug,
    r.title,
    r.summary,
    r.horizon,
    r.status,
    r.owner,
    r.meetingKey,
    r.meetingDate,
    r.excerpt,
    r.changeNote,
    now,
  ]);
  return upsertByKey(handle.spreadsheetId, TAB_DATAHOUSE, DATAHOUSE_HEADERS, values);
}

// ── Category vocabulary ─────────────────────────────────────────────

/**
 * The allowed categories, read from the spreadsheet so the vocabulary can be
 * edited without a deploy. Falls back to the compiled-in seed when the tab is
 * empty — an empty vocabulary would send every meeting to GENERAL.
 */
export async function loadCategories(rootId?: string): Promise<string[]> {
  const handle = await openArchive(rootId);
  const rows = await readTab(handle.spreadsheetId, TAB_CATEGORIES);
  const found = rows
    .slice(1) // header
    .map((r) => sanitizeCategory(r[0] ?? ""))
    .filter((c): c is string => Boolean(c));
  return found.length ? found : [...CATEGORIES];
}

/** Write the seed vocabulary into an empty Categories tab. */
export async function seedCategories(rootId?: string): Promise<void> {
  const handle = await openArchive(rootId);
  const rows = await readTab(handle.spreadsheetId, TAB_CATEGORIES);
  if (rows.length > 1) return; // already populated
  await upsertByKey(
    handle.spreadsheetId,
    TAB_CATEGORIES,
    ["category", "notes"],
    CATEGORIES.map((c) => [c, ""] as Row),
  );
}

// ── Checkpoint ──────────────────────────────────────────────────────

/**
 * Backfill progress, stored in the archive itself rather than the database.
 *
 * Keeping it here means the backfill needs nothing but Drive to resume — the
 * point of the whole rework — and a rebuilt Postgres never loses the position.
 */
export async function readState(name: string, rootId?: string): Promise<string | null> {
  const handle = await openArchive(rootId);
  const rows = await readTab(handle.spreadsheetId, TAB_STATE);
  for (const r of rows.slice(1)) {
    if (r[0] === name) return r[1] ?? null;
  }
  return null;
}

export async function writeState(name: string, value: string, rootId?: string): Promise<void> {
  const handle = await openArchive(rootId);
  await upsertByKey(
    handle.spreadsheetId,
    TAB_STATE,
    ["key", "value", "updated_at"],
    [[name, value, new Date().toISOString()]],
  );
}

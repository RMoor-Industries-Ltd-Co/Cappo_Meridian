import { gmailFetchBodies, type GmailMessageBody } from "@/lib/connectors/gmail";
import { driveExportText } from "@/lib/connectors/driveFs";
import { upsertArchivedMeeting } from "@/lib/db";
import {
  loadCategories,
  loadKeyIndex,
  openArchive,
  seedCategories,
  upsertDatabaseRows,
  writeTranscript,
  SERVICE_BY_SOURCE,
  type DatabaseRow,
} from "./archive";
import { extractMeta, type MeetingMeta } from "./classify";
import { disambiguate, formatMeetingKey, parseMeetingKey } from "./naming";
import { fetchNotionMeetings } from "./sources/notionSource";
import { fetchClickUpMeetings } from "./sources/clickupSource";
import type { DirectRecord } from "./sources/types";

/**
 * Meeting-transcript ingestion, Drive-primary.
 *
 * AMG records meetings across four services and none of them share a store, so
 * discovery runs down TWO paths:
 *
 *   GMAIL (Gemini, Fathom) — these announce themselves by email and carry their
 *   transcript with them, or link to a Drive Doc we can export.
 *
 *   DIRECT API (Notion, ClickUp) — these only ever email a link, which a
 *   Google-scoped integration cannot follow, so their own APIs are read
 *   instead. Routing them through Gmail is what previously reduced them to
 *   stubs.
 *
 * Both paths normalize to the same Candidate shape, so everything downstream —
 * grouping, key assignment, archiving — is identical regardless of origin.
 *
 * WHAT LANDS WHERE. Every service that covered a meeting keeps its own
 * transcript file, so the archive is complete. The spreadsheet gets ONE row per
 * meeting naming which of those files is `analyzed_source`, so downstream
 * analysis counts each initiative once. That split is the whole design.
 *
 * ORDER MATTERS. Messages are grouped into meetings BEFORE keys are assigned.
 * Assigning a key per message instead would give the Gemini and Fathom copies
 * of one meeting two different names the moment their extracted times differed
 * by a second, and the archive would quietly hold two half-meetings.
 */

export type MeetingSource = "gemini" | "fathom" | "notion" | "clickup";

export interface SourceSpec {
  source: MeetingSource;
  rank: number;
  query: string;
  /** Resolve one notification email into transcript text (empty = skip). */
  extract(msg: GmailMessageBody): Promise<string>;
}

/** Newest-first window used by the forward sweep. Backfill passes a range. */
const DEFAULT_LOOKBACK_DAYS = 30;
const MAX_PER_SOURCE = 25;

/**
 * Below this, a record is a stub rather than content — an unshared Gemini Doc,
 * a link-only notification, an empty Notion page. Counted as `skipped` rather
 * than archived, so an empty shell never masquerades as a meeting.
 */
const MIN_TRANSCRIPT_CHARS = 200;

/** Pull the first Google Docs file id out of a notification email. */
function findDocId(msg: GmailMessageBody): string | null {
  const m = /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]{20,})/.exec(msg.html || msg.text);
  return m?.[1] ?? null;
}

export const SOURCES: SourceSpec[] = [
  {
    source: "gemini",
    rank: 1,
    // Gemini "Notes from <meeting>" emails link to a Doc holding the transcript.
    query: 'from:(google.com) subject:("Notes from" OR "Gemini")',
    async extract(msg) {
      const docId = findDocId(msg);
      if (!docId) return "";
      try {
        return await driveExportText(docId);
      } catch {
        // Doc may be owned by another attendee and not shared with this account.
        return "";
      }
    },
  },
  { source: "fathom", rank: 2, query: "from:fathom.video", extract: async (m) => m.text },
];

/**
 * Sources read through their own APIs instead of Gmail.
 *
 * Notion and ClickUp notify by email with a LINK and nothing more, which a
 * Google-scoped integration cannot follow — routing them through Gmail produced
 * stubs. Reading their APIs directly gets the actual content, so they become
 * first-class sources rather than the thin ones.
 *
 * Ranked below Gemini and Fathom: when a meeting was captured by a dedicated
 * transcription service AND written up in Notion, the verbatim transcript is
 * the better basis for analysis than the write-up.
 */
export const DIRECT_SOURCES: {
  source: MeetingSource;
  rank: number;
  fetch(limit: number): Promise<DirectRecord[]>;
}[] = [
  { source: "notion", rank: 3, fetch: fetchNotionMeetings },
  { source: "clickup", rank: 4, fetch: fetchClickUpMeetings },
];

/**
 * Strip the service's boilerplate off a subject so the same meeting recorded by
 * two services collapses to one title.
 *   "Notes from Q3 Supplier Sync" → "q3-supplier-sync"
 */
export function normalizeTitle(subject: string): string {
  return subject
    .replace(/^(re|fwd):\s*/i, "")
    .replace(/^notes? (from|for)\s*/i, "")
    .replace(/\s*[-–—]\s*(gemini|fathom|notion|clickup).*$/i, "")
    .replace(/\s*\(.*?(recording|transcript|notes).*?\)\s*/i, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Content identity: normalized title + calendar date. Two services notifying
 * about the same meeting produce the same value, which is what collapses them
 * into one archive entry.
 */
export function dedupKey(title: string, occurredAt: string): string {
  return `${slugify(normalizeTitle(title)) || "untitled"}|${occurredAt.slice(0, 10)}`;
}

/**
 * One candidate meeting record, normalized across both discovery paths so
 * grouping, key assignment, and archiving don't care how it was found.
 */
interface Candidate {
  source: MeetingSource;
  rank: number;
  /** Gmail message id, or the origin system's record id. */
  ref: string;
  subject: string;
  body: string;
  meta: MeetingMeta;
  /**
   * True when no reliable meeting time was available and the discovery
   * timestamp had to stand in. Drives `duration_known = FALSE`.
   */
  startInferred: boolean;
  start: Date;
  end: Date | null;
}

export interface IngestResult {
  scanned: number;
  /** Transcript files newly written to Drive. */
  archived: number;
  /** Meetings written or refreshed in the Database tab. */
  meetings: number;
  skipped: number;
  bySource: Record<string, number>;
  /** Meetings whose start time fell back to the notification timestamp. */
  inferredTimes: number;
  errors: string[];
}

export interface IngestOptions {
  lookbackDays?: number;
  /** Explicit Gmail date window, e.g. `after:2025/01/01 before:2025/04/01`. */
  window?: string;
  maxPerSource?: number;
  /** Discover and report without writing anything. */
  dryRun?: boolean;
}

/**
 * Sweep every source and file whatever it finds into the Drive archive.
 *
 * Safe to re-run over an overlapping window: transcripts already present are
 * left alone and the Database row is updated in place.
 */
export async function ingestMeetings(options: IngestOptions = {}): Promise<IngestResult> {
  const {
    lookbackDays = DEFAULT_LOOKBACK_DAYS,
    window = `newer_than:${lookbackDays}d`,
    maxPerSource = MAX_PER_SOURCE,
    dryRun = false,
  } = options;

  const result: IngestResult = {
    scanned: 0,
    archived: 0,
    meetings: 0,
    skipped: 0,
    bySource: {},
    inferredTimes: 0,
    errors: [],
  };

  if (!dryRun) {
    await openArchive();
    await seedCategories();
  }
  const categories = dryRun ? undefined : await loadCategories();

  // ── 1. Discover and extract, across every source ──────────────────
  const candidates: Candidate[] = [];
  for (const spec of SOURCES) {
    let msgs: GmailMessageBody[] = [];
    try {
      msgs = await gmailFetchBodies(`${spec.query} ${window}`, maxPerSource);
    } catch (e) {
      result.errors.push(`${spec.source}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    for (const msg of msgs) {
      result.scanned++;
      try {
        const body = (await spec.extract(msg)).trim();
        if (body.length < MIN_TRANSCRIPT_CHARS) {
          // Not a failure — the Doc may not be shared with this account, or the
          // notification simply carries no transcript to follow.
          result.skipped++;
          continue;
        }
        const meta = await extractMeta(msg.subject, body, categories);
        candidates.push({
          source: spec.source,
          rank: spec.rank,
          ref: msg.id,
          subject: msg.subject,
          body,
          meta,
          // The email's timestamp is when the NOTIFICATION arrived, so falling
          // back to it means the meeting time is unknown, not merely imprecise.
          startInferred: !meta.startISO,
          start: new Date(meta.startISO ?? msg.date),
          end: meta.endISO ? new Date(meta.endISO) : null,
        });
      } catch (e) {
        result.errors.push(`${spec.source}/${msg.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // Direct-API sources (Notion, ClickUp). These carry their own record date,
  // which — unlike a notification timestamp — is a real meeting date, so it is
  // trusted when the transcript itself states nothing.
  for (const direct of DIRECT_SOURCES) {
    let records: DirectRecord[] = [];
    try {
      records = await direct.fetch(maxPerSource);
    } catch (e) {
      result.errors.push(`${direct.source}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    for (const rec of records) {
      result.scanned++;
      try {
        const body = rec.body.trim();
        if (body.length < MIN_TRANSCRIPT_CHARS) {
          result.skipped++;
          continue;
        }
        const meta = await extractMeta(rec.title, body, categories);
        const stated = meta.startISO ?? rec.occurredAt;
        candidates.push({
          source: direct.source,
          rank: direct.rank,
          ref: rec.externalId,
          subject: rec.title,
          body,
          meta,
          startInferred: !stated,
          start: new Date(stated ?? Date.now()),
          end: meta.endISO ? new Date(meta.endISO) : null,
        });
      } catch (e) {
        result.errors.push(
          `${direct.source}/${rec.externalId}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  // ── 2. Group candidates into meetings ─────────────────────────────
  const groups = new Map<string, Candidate[]>();
  for (const c of candidates) {
    // Identity uses the meeting's own date when we have it, so a notification
    // that arrived the following morning still groups with its meeting.
    const dk = dedupKey(c.subject, c.start.toISOString());
    const bucket = groups.get(dk);
    if (bucket) bucket.push(c);
    else groups.set(dk, [c]);
  }

  if (dryRun) {
    result.meetings = groups.size;
    result.inferredTimes = [...groups.values()].filter((g) => g.every((c) => c.startInferred)).length;
    for (const g of groups.values()) {
      for (const c of g) result.bySource[c.source] = (result.bySource[c.source] ?? 0) + 1;
    }
    return result;
  }

  // ── 3. Assign keys, write transcripts, upsert rows ────────────────
  const index = await loadKeyIndex();
  const rows: DatabaseRow[] = [];

  for (const [dk, group] of groups) {
    try {
      // The best-ranked source speaks for the meeting: a full Gemini transcript
      // dates and titles it more reliably than a Fathom summary.
      group.sort((a, b) => a.rank - b.rank);
      const best = group[0];

      // Reuse the key this meeting already has, so re-ingestion is idempotent.
      const existing = index.byDedup.get(dk);
      const key =
        existing ??
        disambiguate(
          formatMeetingKey({ category: best.meta.category, start: best.start, end: best.end }),
          index.allKeys,
        );
      index.allKeys.add(key);
      index.byDedup.set(dk, key);

      const written: string[] = [];
      for (const c of group) {
        const folder = SERVICE_BY_SOURCE[c.source];
        if (!folder) continue;
        const { written: isNew } = await writeTranscript(folder, key, c.body);
        written.push(c.source);
        if (isNew) {
          result.archived++;
          result.bySource[c.source] = (result.bySource[c.source] ?? 0) + 1;
        }
      }

      const parsed = parseMeetingKey(key);
      if (best.startInferred) result.inferredTimes++;

      rows.push({
        key,
        dedupKey: dk,
        date: parsed?.date ?? best.start.toISOString().slice(0, 10),
        start: parsed?.start ?? "",
        end: parsed?.end ?? "",
        // False also when the start itself was inferred from the notification —
        // the row must not imply a precision the archive doesn't have.
        durationKnown: Boolean(parsed?.durationKnown) && !best.startInferred,
        category: best.meta.category,
        title: best.meta.title || normalizeTitle(best.subject),
        attendees: best.meta.attendees,
        sources: written,
        analyzedSource: best.source,
        brief: "",
      });
    } catch (e) {
      result.errors.push(`${dk}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (rows.length) {
    await upsertDatabaseRows(rows);
    result.meetings = rows.length;

    // Mirror into Postgres: small structured rows only, no transcript text.
    // The initiative registry foreign-keys to a meeting, and analysis needs a
    // queue of what hasn't been processed. Everything here is rebuildable from
    // the Database tab, so the archive stays the system of record.
    for (const [dk, group] of groups) {
      const row = rows.find((r) => r.dedupKey === dk);
      if (!row) continue;
      try {
        await upsertArchivedMeeting({
          archiveKey: row.key,
          title: row.title,
          occurredAt: group[0].start.toISOString(),
          dedupKey: dk,
          participants: row.attendees,
          category: row.category,
          analyzedSource: row.analyzedSource,
        });
      } catch (e) {
        // The archive write already succeeded; a cache miss is recoverable and
        // must not be reported as a failed ingest.
        result.errors.push(`cache/${row.key}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  return result;
}

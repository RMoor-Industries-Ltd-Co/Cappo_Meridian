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

/**
 * Meeting-transcript ingestion, Drive-primary.
 *
 * AMG records meetings across four services and none of them share a store. The
 * one signal common to all of them is a notification email, so every source is
 * discovered through Gmail and then followed to wherever the transcript
 * actually lives (a Drive Doc for Gemini, the message body for the rest).
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
 * Below this, a "transcript" is a notification stub rather than content.
 *
 * Notion and ClickUp notification emails are usually a link, not the notes, and
 * under a Google-only integration there is no way to follow that link. Those
 * sources therefore contribute little; that is a known consequence of the
 * scope, not a bug, and it shows up as `skipped` in the result.
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
  {
    source: "notion",
    rank: 3,
    query: "from:notion.so subject:(meeting OR notes OR transcript)",
    extract: async (m) => m.text,
  },
  {
    source: "clickup",
    rank: 4,
    query: "from:clickup.com subject:(recording OR transcript OR notes)",
    extract: async (m) => m.text,
  },
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

interface Candidate {
  spec: SourceSpec;
  msg: GmailMessageBody;
  body: string;
  meta: MeetingMeta;
  /** True when the start time came from the notification, not the transcript. */
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
        const startInferred = !meta.startISO;
        candidates.push({
          spec,
          msg,
          body,
          meta,
          startInferred,
          start: new Date(meta.startISO ?? msg.date),
          end: meta.endISO ? new Date(meta.endISO) : null,
        });
      } catch (e) {
        result.errors.push(`${spec.source}/${msg.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // ── 2. Group candidates into meetings ─────────────────────────────
  const groups = new Map<string, Candidate[]>();
  for (const c of candidates) {
    // Identity uses the meeting's own date when we have it, so a notification
    // that arrived the following morning still groups with its meeting.
    const dk = dedupKey(c.msg.subject, c.start.toISOString());
    const bucket = groups.get(dk);
    if (bucket) bucket.push(c);
    else groups.set(dk, [c]);
  }

  if (dryRun) {
    result.meetings = groups.size;
    result.inferredTimes = [...groups.values()].filter((g) => g.every((c) => c.startInferred)).length;
    for (const g of groups.values()) {
      for (const c of g) result.bySource[c.spec.source] = (result.bySource[c.spec.source] ?? 0) + 1;
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
      group.sort((a, b) => a.spec.rank - b.spec.rank);
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
        const folder = SERVICE_BY_SOURCE[c.spec.source];
        if (!folder) continue;
        const { written: isNew } = await writeTranscript(folder, key, c.body);
        written.push(c.spec.source);
        if (isNew) {
          result.archived++;
          result.bySource[c.spec.source] = (result.bySource[c.spec.source] ?? 0) + 1;
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
        title: best.meta.title || normalizeTitle(best.msg.subject),
        attendees: best.meta.attendees,
        sources: written,
        analyzedSource: best.spec.source,
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

import { gmailFetchBodies, type GmailMessageBody } from "@/lib/connectors/gmail";
import { driveExportText } from "@/lib/connectors/driveFs";
import { insertTranscript, upsertMeeting, type MeetingSource } from "@/lib/db";

/**
 * Meeting-transcript ingestion.
 *
 * AMG records meetings across four services and none of them share a store. The
 * one signal common to all of them is a notification email, so every source is
 * discovered through Gmail and then followed to wherever the transcript actually
 * lives (a Drive Doc for Gemini, the message body for the rest).
 *
 * Sources carry a rank: when several services covered the same meeting, only the
 * best-ranked transcript is analyzed. A full Gemini transcript beats a Fathom
 * summary, and analyzing both would count every initiative twice.
 */

export interface SourceSpec {
  source: MeetingSource;
  rank: number;
  query: string;
  /** Resolve one notification email into transcript text (empty = skip). */
  extract(msg: GmailMessageBody): Promise<string>;
}

/** Newest-first window. Meetings older than this are backfilled by raising it. */
const DEFAULT_LOOKBACK_DAYS = 30;
const MAX_PER_SOURCE = 25;

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
  {
    source: "fathom",
    rank: 2,
    query: "from:fathom.video",
    async extract(msg) {
      return msg.text;
    },
  },
  {
    source: "notion",
    rank: 3,
    query: "from:notion.so subject:(meeting OR notes OR transcript)",
    async extract(msg) {
      return msg.text;
    },
  },
  {
    source: "clickup",
    rank: 4,
    query: "from:clickup.com subject:(recording OR transcript OR notes)",
    async extract(msg) {
      return msg.text;
    },
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
 * Dedup key: normalized title + calendar date. Two services notifying about the
 * same meeting produce the same key, so they attach to one `meetings` row as
 * separate transcripts rather than two competing meetings.
 */
export function dedupKey(title: string, occurredAt: string): string {
  return `${slugify(normalizeTitle(title)) || "untitled"}|${occurredAt.slice(0, 10)}`;
}

export interface IngestResult {
  scanned: number;
  ingested: number;
  skipped: number;
  bySource: Record<string, number>;
  errors: string[];
}

/** Sweep every source and persist any transcript not already stored. */
export async function ingestMeetings(lookbackDays = DEFAULT_LOOKBACK_DAYS): Promise<IngestResult> {
  const result: IngestResult = { scanned: 0, ingested: 0, skipped: 0, bySource: {}, errors: [] };
  const window = `newer_than:${lookbackDays}d`;

  for (const spec of SOURCES) {
    let msgs: GmailMessageBody[] = [];
    try {
      msgs = await gmailFetchBodies(`${spec.query} ${window}`, MAX_PER_SOURCE);
    } catch (e) {
      result.errors.push(`${spec.source}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    for (const msg of msgs) {
      result.scanned++;
      try {
        const body = (await spec.extract(msg)).trim();
        // A notification with no reachable transcript is not a failure — the Doc
        // may simply not be shared with the connected account.
        if (body.length < 200) {
          result.skipped++;
          continue;
        }
        const title = normalizeTitle(msg.subject) || msg.subject;
        const meetingId = await upsertMeeting({
          title,
          occurredAt: msg.date,
          dedupKey: dedupKey(msg.subject, msg.date),
        });
        if (!meetingId) {
          result.errors.push("database not configured");
          return result;
        }
        const wrote = await insertTranscript({
          meetingId,
          source: spec.source,
          sourceRef: msg.id,
          rank: spec.rank,
          body,
        });
        if (wrote) {
          result.ingested++;
          result.bySource[spec.source] = (result.bySource[spec.source] ?? 0) + 1;
        } else {
          result.skipped++;
        }
      } catch (e) {
        result.errors.push(`${spec.source}/${msg.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  return result;
}

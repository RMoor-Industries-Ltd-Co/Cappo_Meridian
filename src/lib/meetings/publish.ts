import { clickupCreateTask } from "@/lib/connectors/clickup";
import { createDecision, createMeetingNote, isWikiConfigured } from "@/lib/connectors/notionWiki";
import {
  listInitiatives,
  markInitiativeDecisionLogged,
  markMeetingPublished,
  setInitiativeClickUpUrl,
  unloggedClosedInitiatives,
  unpublishedMeetings,
  type Initiative,
} from "@/lib/db";
import { openArchive } from "./archive";

/**
 * Publishing — the outbound half of the Notion/ClickUp integration.
 *
 * Ingestion pulls meeting content OUT of Notion and ClickUp; this pushes the
 * extracted result BACK, so each tool ends up holding what it is actually for
 * (the placement convention in CLAUDE.md):
 *
 *   Drive   — the archive. Transcripts and the meeting database. Already done
 *             by the ingest path; nothing is published here.
 *   ClickUp — "what are we working on right now". Every ACTIVE initiative
 *             becomes a task, and its URL is stored back on the initiative so
 *             the link is two-way and the task is never created twice.
 *   Notion  — the wiki. Meetings land in the Meeting Notes index; CLOSED
 *             initiatives land in the Decisions Log, because deciding something
 *             is finished or abandoned is exactly a decision worth recording.
 *
 * IDEMPOTENCE IS THE WHOLE PROBLEM HERE. Unlike the archive, these systems have
 * no natural key to upsert on — calling this twice would create two tasks and
 * two wiki rows, and there is no clean way to remove them afterwards. So every
 * publish is gated on a stored marker: an initiative with a `clickup_url` is
 * never re-tasked, and a meeting with `published_at` is never re-indexed.
 */

export interface PublishResult {
  tasksCreated: number;
  decisionsLogged: number;
  meetingsIndexed: number;
  skipped: number;
  errors: string[];
}

/** Tag applied to every task this system opens, so they're filterable. */
const TASK_TAG = "meeting-intelligence";

function taskBody(i: Initiative): string {
  const lines = [i.summary, "", `Horizon: ${i.horizon}`];
  if (i.owner) lines.push(`Owner: ${i.owner}`);
  lines.push(`First seen: ${i.first_seen_at.slice(0, 10)}`);
  lines.push("", "Opened automatically from AMG meeting intelligence.");
  return lines.join("\n");
}

/**
 * Push the current state outward.
 *
 * Failures are collected rather than thrown: publishing to three external
 * systems partially succeeding is normal, and a Notion outage must not prevent
 * the ClickUp half from running (or vice versa).
 */
export async function publishOutbound(limit = 25): Promise<PublishResult> {
  const out: PublishResult = {
    tasksCreated: 0,
    decisionsLogged: 0,
    meetingsIndexed: 0,
    skipped: 0,
    errors: [],
  };

  // ── ClickUp: active initiatives become tasks ──────────────────────
  const initiatives = await listInitiatives(true);
  for (const i of initiatives.slice(0, limit)) {
    if (i.status !== "active") continue;
    if (i.clickup_url) {
      out.skipped++; // already has a task — never create a second
      continue;
    }
    try {
      const task = await clickupCreateTask({
        name: i.title,
        tag: TASK_TAG,
        description: taskBody(i),
      });
      // Store the URL BEFORE counting it: if this write fails, the next run
      // would otherwise create a duplicate task with no record of the first.
      await setInitiativeClickUpUrl(i.slug, task.url);
      out.tasksCreated++;
    } catch (e) {
      out.errors.push(`clickup/${i.slug}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (!isWikiConfigured()) {
    out.errors.push("Notion not configured — skipped wiki publishing");
    return out;
  }

  // ── Notion: closed initiatives become decisions ───────────────────
  // Gated on its own marker rather than on clickup_url — an initiative can be
  // closed without ever having had a task, and reusing the wrong marker would
  // either skip it forever or log it on every run.
  for (const i of await unloggedClosedInitiatives(limit)) {
    try {
      await createDecision({
        decision: `${i.title} — ${i.status}`,
        status: i.status === "completed" ? "Completed" : "Dropped",
        date: i.last_seen_at.slice(0, 10),
        context: `${i.summary}\n\nRecorded from AMG meeting intelligence.${i.clickup_url ? `\nClickUp: ${i.clickup_url}` : ""}`,
      });
      await markInitiativeDecisionLogged(i.slug);
      out.decisionsLogged++;
    } catch (e) {
      out.errors.push(`notion-decision/${i.slug}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Notion: meetings land in the Meeting Notes index ──────────────
  const handle = await openArchive().catch(() => null);
  const folderUrl = handle
    ? `https://drive.google.com/drive/folders/${handle.rootId}`
    : null;

  for (const m of await unpublishedMeetings(limit)) {
    try {
      await createMeetingNote({
        title: m.title,
        date: m.occurred_at.slice(0, 10),
        // The index's Source names which service produced the analyzed
        // transcript, matching how the archive recorded it.
        source: m.analyzed_source ?? undefined,
        // Link to the archive rather than re-uploading the transcript: Drive is
        // the system of record, and Notion holds links to Drive, not copies.
        link: folderUrl ?? undefined,
        summary: m.brief ?? undefined,
      });
      await markMeetingPublished(m.id);
      out.meetingsIndexed++;
    } catch (e) {
      out.errors.push(`notion-meeting/${m.archive_key}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return out;
}

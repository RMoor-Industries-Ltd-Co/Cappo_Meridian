import type { MeetingSource } from "../ingest";

/**
 * A meeting record pulled straight from a service's own API, rather than
 * discovered through a Gmail notification.
 *
 * Gemini and Fathom announce themselves by email and carry their transcript
 * with them, so Gmail is a workable front door for those two. Notion and
 * ClickUp only email a LINK, which a Google-scoped integration cannot follow —
 * so they are read directly instead. This is the shape both paths converge on,
 * so grouping, key assignment, and archiving stay identical regardless of how a
 * meeting was found.
 */
export interface DirectRecord {
  source: MeetingSource;
  /** Stable id in the origin system (Notion page id, ClickUp doc id). */
  externalId: string;
  title: string;
  /** ISO instant the meeting occurred, or null when the service doesn't say. */
  occurredAt: string | null;
  body: string;
  /** Back-link to the record in its origin system. */
  link: string | null;
}

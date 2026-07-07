import { getMeetingNotes, isWikiConfigured, type MeetingNote } from "@/lib/connectors/notionWiki";
import { clickupMeetingDocs } from "@/lib/connectors/clickup";
import { env } from "@/lib/env";

/**
 * The unified Meetings index. Meetings live in more than one place: manually /
 * Gemini-logged rows in the Notion "Meeting Notes" database, and transcribed
 * ClickUp Docs. This merges every configured source into one MeetingNote list,
 * newest first, tagged by `source` so the /meetings tabs can split them.
 *
 * Each source is independently gated + guarded — an outage or missing token in
 * one never blanks the others.
 */

function isClickUpConfigured(): boolean {
  return Boolean(env.CLICKUP_API_TOKEN);
}

export function isMeetingsConfigured(): boolean {
  return isWikiConfigured() || isClickUpConfigured();
}

export async function getMeetingsFeed(limit = 100): Promise<MeetingNote[]> {
  const [notion, clickup] = await Promise.all([
    isWikiConfigured() ? getMeetingNotes(limit).catch(() => []) : Promise.resolve([]),
    isClickUpConfigured() ? clickupMeetingDocs(limit).catch(() => []) : Promise.resolve([]),
  ]);

  const clickupNotes: MeetingNote[] = clickup.map((d) => ({
    id: `cu-${d.id}`,
    title: d.title,
    date: d.date,
    source: "ClickUp",
    link: d.url,
    summary: d.summary,
    url: d.url,
  }));

  return [...notion, ...clickupNotes]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, limit);
}

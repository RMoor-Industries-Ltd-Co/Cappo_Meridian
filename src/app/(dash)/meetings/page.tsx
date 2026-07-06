import { getMeetingNotes, isWikiConfigured } from "@/lib/connectors/notionWiki";
import { MeetingsClient } from "@/components/meetings/MeetingsClient";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const meetings = isWikiConfigured() ? await getMeetingNotes(100).catch(() => []) : [];
  return <MeetingsClient meetings={meetings} configured={isWikiConfigured()} />;
}

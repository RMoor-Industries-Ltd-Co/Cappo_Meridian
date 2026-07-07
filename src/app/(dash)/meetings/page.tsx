import { getMeetingsFeed, isMeetingsConfigured } from "@/lib/meetingsFeed";
import { MeetingsClient } from "@/components/meetings/MeetingsClient";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const configured = isMeetingsConfigured();
  const meetings = configured ? await getMeetingsFeed(100).catch(() => []) : [];
  return <MeetingsClient meetings={meetings} configured={configured} />;
}

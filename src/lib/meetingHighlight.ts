import { getConnector } from "@/lib/connectors";
import { clickupTasksByTag } from "@/lib/connectors/clickup";
import { getDomainBundle, getMeetingNotesByDomain, isWikiConfigured } from "@/lib/connectors/notionWiki";

export interface MeetingHighlight {
  title: string;
  meta: string;
  url: string;
  kind: "task" | "action" | "meeting";
}

/**
 * Picks the single "highest priority" open item for a domain, to surface as the
 * Meetings nav hover highlight. This is a v1 heuristic over real, structured
 * data (ClickUp task due dates, open Notion Actions, then recent meeting notes)
 * — not the full AI-interpreted-transcript ranking described as the eventual
 * goal, which needs real transcript ingestion (Fathom/Gemini/Calendly aren't
 * live connectors yet, just manual "Source" tags on meeting notes).
 */
export async function getHighestPriorityForDomains(domains: string[]): Promise<MeetingHighlight | null> {
  if (domains.length === 0) return null;

  const clickup = getConnector("clickup");
  const clickupConfigured = Boolean(clickup?.isConfigured());
  const notionConfigured = isWikiConfigured();
  if (!clickupConfigured && !notionConfigured) return null;

  const results = await Promise.all(
    domains.map(async (name) => {
      const [tasks, bundle, meetings] = await Promise.all([
        clickupConfigured ? clickupTasksByTag(name.toLowerCase()).catch(() => []) : Promise.resolve([]),
        notionConfigured
          ? getDomainBundle(name).catch(() => ({ catalog: [], documents: [], decisions: [], actions: [], captures: [], glossary: [] }))
          : Promise.resolve({ catalog: [], documents: [], decisions: [], actions: [], captures: [], glossary: [] }),
        notionConfigured ? getMeetingNotesByDomain(name, 3).catch(() => []) : Promise.resolve([]),
      ]);
      return { name, tasks, bundle, meetings };
    }),
  );

  // 1) Soonest-due open ClickUp task, across all mapped domains.
  const openTasks = results
    .flatMap((r) => r.tasks)
    .filter((t) => t.statusType !== "done" && t.statusType !== "closed" && t.due);
  if (openTasks.length > 0) {
    openTasks.sort((a, b) => new Date(a.due!).getTime() - new Date(b.due!).getTime());
    const t = openTasks[0];
    return { title: t.name, meta: `Due ${new Date(t.due!).toLocaleDateString()} · ${t.status}`, url: t.url, kind: "task" };
  }

  // 2) Any open ClickUp task without a due date.
  const anyOpenTask = results.flatMap((r) => r.tasks).find((t) => t.statusType !== "done" && t.statusType !== "closed");
  if (anyOpenTask) {
    return { title: anyOpenTask.name, meta: anyOpenTask.status, url: anyOpenTask.url, kind: "task" };
  }

  // 3) First open Notion Action tagged to the domain.
  const openAction = results.flatMap((r) => r.bundle.actions).find((a) => !/done|complete/i.test(a.meta));
  if (openAction) {
    return { title: openAction.title, meta: openAction.meta || "Action", url: openAction.url, kind: "action" };
  }

  // 4) Most recent meeting note tagged to the domain.
  const meeting = results.flatMap((r) => r.meetings).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
  if (meeting) {
    return {
      title: meeting.title,
      meta: [meeting.source, meeting.date ? new Date(meeting.date).toLocaleDateString() : ""].filter(Boolean).join(" · "),
      url: meeting.link || meeting.url,
      kind: "meeting",
    };
  }

  return null;
}

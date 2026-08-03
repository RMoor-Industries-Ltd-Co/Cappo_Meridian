import { env } from "@/lib/env";
import type { DirectRecord } from "./types";

/**
 * ClickUp meeting content, read through the ClickUp Docs API rather than Gmail.
 *
 * Same reasoning as the Notion source: ClickUp's notification emails carry a
 * link, not the notes, and a Google-scoped integration cannot follow it. Docs
 * are where ClickUp actually keeps written meeting content, so it is read
 * directly.
 *
 * Docs live on API v3, not the v2 base the rest of the ClickUp connector uses.
 */

const API_V3 = "https://api.clickup.com/api/v3";

async function clickupV3<T>(path: string): Promise<T> {
  const token = env.CLICKUP_API_TOKEN;
  if (!token) throw new Error("CLICKUP_API_TOKEN not set");
  const res = await fetch(`${API_V3}${path}`, {
    headers: { Authorization: token, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ClickUp ${path} → ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export function isClickUpSourceConfigured(): boolean {
  return Boolean(env.CLICKUP_API_TOKEN && env.CLICKUP_TEAM_ID);
}

/**
 * Not every ClickUp doc is a meeting — most are specs, runbooks, and notes.
 * Filing all of them as meetings would bury the real record, so the doc title
 * has to look like a meeting for it to be ingested. This is a deliberate
 * heuristic: it under-collects rather than over-collects, and widening it is a
 * one-line change once the real yield is known.
 */
const MEETING_TITLE = /\b(meeting|standup|stand-up|sync|1:1|one[- ]on[- ]one|retro|review|call|notes|minutes|debrief|kickoff|kick-off)\b/i;

interface DocSummary {
  id: string;
  name?: string;
  date_created?: string | number;
}

interface DocPage {
  id: string;
  name?: string;
  content?: string;
}

/**
 * Pull recent ClickUp docs whose titles read like meetings, concatenating their
 * pages into one body.
 */
export async function fetchClickUpMeetings(limit = 50): Promise<DirectRecord[]> {
  if (!isClickUpSourceConfigured()) return [];
  const workspace = env.CLICKUP_TEAM_ID;

  let docs: DocSummary[] = [];
  try {
    const res = await clickupV3<{ docs?: DocSummary[] }>(
      `/workspaces/${workspace}/docs?limit=${Math.min(limit, 100)}&deleted=false&archived=false`,
    );
    docs = res.docs ?? [];
  } catch {
    // Docs may be disabled on the plan, or the token may lack the scope. That
    // is a missing source, not a failed ingest.
    return [];
  }

  const out: DirectRecord[] = [];
  for (const doc of docs) {
    const name = doc.name ?? "";
    if (!MEETING_TITLE.test(name)) continue;

    let body = "";
    try {
      const pages = await clickupV3<DocPage[]>(
        `/workspaces/${workspace}/docs/${doc.id}/pages?content_format=text%2Fmd`,
      );
      body = (Array.isArray(pages) ? pages : [])
        .map((p) => [p.name, p.content].filter(Boolean).join("\n"))
        .filter(Boolean)
        .join("\n\n")
        .trim();
    } catch {
      continue; // unreadable doc — skip rather than archive an empty shell
    }
    if (!body) continue;

    const created = doc.date_created ? Number(doc.date_created) : NaN;
    out.push({
      source: "clickup",
      externalId: doc.id,
      title: name,
      occurredAt: Number.isFinite(created) ? new Date(created).toISOString() : null,
      body,
      link: null,
    });
  }
  return out;
}

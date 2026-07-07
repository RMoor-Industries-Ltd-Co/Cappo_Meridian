import { env } from "@/lib/env";
import type { ConnectorStatus, UnifiedItem } from "@/lib/types";
import { type Connector, notConfigured } from "./connector";

const API = "https://api.clickup.com/api/v2";
const API_V3 = "https://api.clickup.com/api/v3";

async function clickup<T>(path: string, init?: RequestInit): Promise<T> {
  const token = env.CLICKUP_API_TOKEN;
  if (!token) throw new Error("CLICKUP_API_TOKEN not set");

  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: token, "Content-Type": "application/json" },
    // ClickUp data changes often; never serve stale.
    cache: "no-store",
    ...init,
  });
  if (!res.ok) {
    throw new Error(`ClickUp ${path} → ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/** ClickUp Docs live on the v3 API (Docs aren't exposed on v2). */
async function clickupV3<T>(path: string): Promise<T> {
  const token = env.CLICKUP_API_TOKEN;
  if (!token) throw new Error("CLICKUP_API_TOKEN not set");

  const res = await fetch(`${API_V3}${path}`, {
    headers: { Authorization: token, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`ClickUp ${path} → ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const clickupConnector: Connector = {
  id: "clickup",
  name: "ClickUp",

  isConfigured: () => Boolean(env.CLICKUP_API_TOKEN),

  async checkConnection(): Promise<ConnectorStatus> {
    if (!this.isConfigured()) return notConfigured(this.id, this.name);
    try {
      const { user } = await clickup<{ user: { username: string; email: string } }>(
        "/user",
      );
      return {
        id: this.id,
        name: this.name,
        configured: true,
        connected: true,
        detail: `Authenticated as ${user.username} (${user.email})`,
      };
    } catch (err) {
      return {
        id: this.id,
        name: this.name,
        configured: true,
        connected: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  async listRecent(limit = 25): Promise<UnifiedItem[]> {
    // Requires a team (workspace) id. Resolve the first team if not provided.
    let teamId = env.CLICKUP_TEAM_ID;
    if (!teamId) {
      const { teams } = await clickup<{ teams: { id: string }[] }>("/team");
      teamId = teams[0]?.id;
      if (!teamId) return [];
    }

    const recentParams = new URLSearchParams({
      order_by: "updated",
      reverse: "true",
      subtasks: "true",
    });
    if (env.CLICKUP_SPACE_ID) recentParams.append("space_ids[]", env.CLICKUP_SPACE_ID);

    const { tasks } = await clickup<{
      tasks: {
        id: string;
        name: string;
        url: string;
        status?: { status: string };
        date_updated?: string;
      }[];
    }>(`/team/${teamId}/task?${recentParams.toString()}`);

    return tasks.slice(0, limit).map((t) => ({
      id: t.id,
      source: "clickup" as const,
      kind: "task" as const,
      title: t.name,
      url: t.url,
      status: t.status?.status,
      updatedAt: t.date_updated
        ? new Date(Number(t.date_updated)).toISOString()
        : undefined,
    }));
  },
};

/** Calendar event shape returned to the client (dates as ISO strings). */
export interface ClickUpCalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string;
  status?: string;
  url?: string;
}

interface ClickUpTask {
  id: string;
  name: string;
  url: string;
  status?: { status: string; color?: string };
  start_date?: string | null;
  due_date?: string | null;
  due_date_time?: boolean;
  start_date_time?: boolean;
}

async function resolveTeamId(): Promise<string | undefined> {
  if (env.CLICKUP_TEAM_ID) return env.CLICKUP_TEAM_ID;
  const { teams } = await clickup<{ teams: { id: string }[] }>("/team");
  return teams[0]?.id;
}

/**
 * ClickUp tasks with due dates in [startMs, endMs], mapped to calendar events.
 * Tasks become the calendar — coloured by their ClickUp status, linking back to
 * the task. Tasks without a time-of-day are treated as all-day.
 */
export async function clickupCalendarEvents(
  startMs: number,
  endMs: number,
): Promise<ClickUpCalEvent[]> {
  const teamId = await resolveTeamId();
  if (!teamId) return [];

  const params = new URLSearchParams({
    include_closed: "true",
    subtasks: "true",
    order_by: "due_date",
    due_date_gt: String(startMs),
    due_date_lt: String(endMs),
  });
  // Scope to the AMG space when configured.
  if (env.CLICKUP_SPACE_ID) params.append("space_ids[]", env.CLICKUP_SPACE_ID);

  const { tasks } = await clickup<{ tasks: ClickUpTask[] }>(
    `/team/${teamId}/task?${params.toString()}`,
  );

  return tasks
    .filter((t) => t.due_date)
    .map((t) => {
      const due = new Date(Number(t.due_date));
      const start = t.start_date ? new Date(Number(t.start_date)) : due;
      const timed = t.due_date_time === true;
      const s = start;
      let e = due;
      if (s.getTime() >= e.getTime()) e = new Date(s.getTime() + 60 * 60 * 1000);
      return {
        id: t.id,
        title: t.name,
        start: s.toISOString(),
        end: e.toISOString(),
        allDay: !timed,
        color: t.status?.color || "var(--gold)",
        status: t.status?.status,
        url: t.url,
      };
    });
}

/** A task surfaced in a function module (filtered by tag within the AMG space). */
export interface ModuleTask {
  id: string;
  name: string;
  url: string;
  status: string;
  statusColor: string;
  statusType: string; // "open" | "custom" | "done" | "closed"
  due: string | null; // ISO
  assignees: string[];
}

interface TaggedTaskRaw {
  id: string;
  name: string;
  url: string;
  status?: { status: string; color?: string; type?: string; orderindex?: number | string };
  due_date?: string | null;
  assignees?: { username?: string; email?: string }[];
}

/**
 * AMG-space tasks carrying a given tag (the function-module data source).
 * Returns [] when ClickUp isn't configured or the tag has no tasks.
 */
export async function clickupTasksByTag(tag: string): Promise<ModuleTask[]> {
  const teamId = await resolveTeamId();
  if (!teamId) return [];

  const params = new URLSearchParams({
    include_closed: "true",
    subtasks: "true",
    order_by: "due_date",
  });
  if (env.CLICKUP_SPACE_ID) params.append("space_ids[]", env.CLICKUP_SPACE_ID);
  params.append("tags[]", tag);

  const { tasks } = await clickup<{ tasks: TaggedTaskRaw[] }>(
    `/team/${teamId}/task?${params.toString()}`,
  );

  return tasks.map((t) => ({
    id: t.id,
    name: t.name,
    url: t.url,
    status: t.status?.status ?? "—",
    statusColor: t.status?.color ?? "var(--gold)",
    statusType: t.status?.type ?? "open",
    due: t.due_date ? new Date(Number(t.due_date)).toISOString() : null,
    assignees: (t.assignees ?? [])
      .map((a) => a.username || a.email || "")
      .filter(Boolean),
  }));
}

/** Resolve the list to create new tasks in — the current quarter's Agenda. */
async function resolveModuleListId(): Promise<string | undefined> {
  if (!env.CLICKUP_SPACE_ID) {
    // No space pinned — fall back to the first list of the first team space.
    const teamId = await resolveTeamId();
    if (!teamId) return undefined;
    const { spaces } = await clickup<{ spaces: { id: string }[] }>(`/team/${teamId}/space`);
    if (!spaces[0]) return undefined;
    env.CLICKUP_SPACE_ID = spaces[0].id;
  }
  const { folders } = await clickup<{
    folders: { name: string; lists: { id: string; name: string }[] }[];
  }>(`/space/${env.CLICKUP_SPACE_ID}/folder?archived=false`);

  const q = `Q${Math.floor(new Date().getMonth() / 3) + 1}`;
  const folder =
    folders.find((f) => f.name.trim().toUpperCase() === q) ||
    folders.find((f) => f.lists?.length);
  const list = folder?.lists?.find((l) => /agenda/i.test(l.name)) || folder?.lists?.[0];
  return list?.id;
}

/** List AMG-space tasks (optionally filtered by tag) — for the delegated agent. */
export async function clickupListTasks(
  tag?: string,
): Promise<{ id: string; name: string; status: string; due: string | null }[]> {
  const teamId = await resolveTeamId();
  if (!teamId) return [];
  const params = new URLSearchParams({
    include_closed: "true",
    subtasks: "true",
    order_by: "due_date",
  });
  if (env.CLICKUP_SPACE_ID) params.append("space_ids[]", env.CLICKUP_SPACE_ID);
  if (tag) params.append("tags[]", tag);
  const { tasks } = await clickup<{
    tasks: { id: string; name: string; status?: { status: string }; due_date?: string | null }[];
  }>(`/team/${teamId}/task?${params.toString()}`);
  return tasks.map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status?.status ?? "—",
    due: t.due_date ? new Date(Number(t.due_date)).toISOString().slice(0, 10) : null,
  }));
}

/** Update an AMG task by id (name / status / due date). */
export async function clickupUpdateTask(
  taskId: string,
  fields: { name?: string; status?: string; dueMs?: number },
): Promise<string> {
  const body: { name?: string; status?: string; due_date?: number; due_date_time?: boolean } = {};
  if (fields.name) body.name = fields.name;
  if (fields.status) body.status = fields.status;
  if (fields.dueMs) {
    body.due_date = fields.dueMs;
    body.due_date_time = false;
  }
  if (Object.keys(body).length === 0) return "Nothing to update.";
  await clickup(`/task/${taskId}`, { method: "PUT", body: JSON.stringify(body) });
  return `Updated AMG task ${taskId}: ${Object.keys(body).join(", ")}`;
}

/** Create a task in the AMG space (current quarter), optionally tagged + due. */
export async function clickupCreateTask(input: {
  name: string;
  tag?: string;
  dueMs?: number | null;
}): Promise<{ id: string; url: string }> {
  const listId = await resolveModuleListId();
  if (!listId) throw new Error("No AMG list available to create the task in");

  const body: { name: string; tags?: string[]; due_date?: number; due_date_time?: boolean } = {
    name: input.name,
  };
  if (input.tag) body.tags = [input.tag];
  if (input.dueMs) {
    body.due_date = input.dueMs;
    body.due_date_time = false;
  }

  const task = await clickup<{ id: string; url: string }>(`/list/${listId}/task`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { id: task.id, url: task.url };
}

/** A current AMG-space task on the Operations swim-lane board. */
export interface BoardTask {
  id: string;
  name: string;
  url: string;
  status: string;
  statusColor: string;
  statusType: string;
  statusOrder: number;
  due: string | null;
  assignees: string[];
}
export interface BoardStatus {
  name: string;
  color: string;
  type: string;
  order: number;
}

/**
 * Open tasks across the AMG ClickUp space, grouped-ready by status — the
 * Operations panel's swim lanes ("what are we working on right now").
 */
export async function clickupAmgBoard(): Promise<{ tasks: BoardTask[]; statuses: BoardStatus[] }> {
  const teamId = await resolveTeamId();
  if (!teamId) return { tasks: [], statuses: [] };

  const params = new URLSearchParams({
    include_closed: "false",
    subtasks: "true",
    order_by: "due_date",
  });
  if (env.CLICKUP_SPACE_ID) params.append("space_ids[]", env.CLICKUP_SPACE_ID);

  const { tasks } = await clickup<{ tasks: TaggedTaskRaw[] }>(
    `/team/${teamId}/task?${params.toString()}`,
  );

  const board: BoardTask[] = tasks.map((t) => ({
    id: t.id,
    name: t.name,
    url: t.url,
    status: t.status?.status ?? "—",
    statusColor: t.status?.color ?? "var(--gold)",
    statusType: t.status?.type ?? "open",
    statusOrder: Number(t.status?.orderindex ?? 0) || 0,
    due: t.due_date ? new Date(Number(t.due_date)).toISOString() : null,
    assignees: (t.assignees ?? []).map((a) => a.username || a.email || "").filter(Boolean),
  }));

  const seen = new Map<string, BoardStatus>();
  for (const t of board) {
    if (!seen.has(t.status)) {
      seen.set(t.status, { name: t.status, color: t.statusColor, type: t.statusType, order: t.statusOrder });
    }
  }
  const statuses = [...seen.values()].sort((a, b) => a.order - b.order);
  return { tasks: board, statuses };
}

/** Move a task to a different status (drag-a-swim-lane equivalent). */
export async function clickupSetStatus(taskId: string, status: string): Promise<void> {
  await clickup(`/task/${taskId}`, { method: "PUT", body: JSON.stringify({ status }) });
}

/** A transcribed meeting held as a ClickUp Doc (AI-summarised notes). */
export interface ClickUpMeetingDoc {
  id: string;
  title: string;
  date: string | null; // ISO — the meeting date, parsed from the doc name
  url: string;
  summary: string;
}

interface RawDocV3 {
  id: string;
  name?: string;
  date_created?: number | string;
  date_updated?: number | string;
}
interface RawDocPageV3 {
  id: string;
  content?: string;
}

/** Pull a meeting date out of a doc name like "AMG Business Meeting - 07/01/2026". */
function meetingDateFromName(name: string): string | null {
  const m = name.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** The "Overview" prose (or leading prose) from a doc's markdown, as a short summary. */
function overviewFromContent(content: string): string {
  if (!content) return "";
  const ov = content.match(/#+\s*Overview\s*\n+([\s\S]*?)(?:\n#+\s|\n\s*-\s*\[|$)/i);
  const block = (ov?.[1] ?? content)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // strip images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → their text
    .replace(/[*_#>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return block.slice(0, 400);
}

/**
 * Transcribed meetings held as ClickUp Docs — the live ClickUp source for the
 * Meetings index (see lib/meetingsFeed.ts). Lists workspace docs, keeps the
 * meeting-named ones, and best-effort enriches each with its Overview summary.
 * Summary enrichment is guarded per-doc: a failure yields an empty summary,
 * never a broken feed.
 */
export async function clickupMeetingDocs(limit = 25): Promise<ClickUpMeetingDoc[]> {
  const teamId = await resolveTeamId();
  if (!teamId) return [];

  const params = new URLSearchParams({ limit: "100" });
  const res = await clickupV3<{ docs?: RawDocV3[] } | RawDocV3[]>(
    `/workspaces/${teamId}/docs?${params.toString()}`,
  );
  const docs = Array.isArray(res) ? res : (res.docs ?? []);

  const meetings = docs
    .filter((d) => /meeting/i.test(d.name ?? ""))
    .map((d) => {
      const name = d.name ?? "Untitled meeting";
      const created = d.date_created ? new Date(Number(d.date_created)).toISOString() : null;
      return {
        id: d.id,
        title: name,
        date: meetingDateFromName(name) ?? created,
        url: `https://app.clickup.com/${teamId}/docs/${d.id}`,
        summary: "",
      };
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, limit);

  // Best-effort Overview summaries, in parallel, each independently guarded.
  await Promise.all(
    meetings.map(async (m) => {
      try {
        const pages = await clickupV3<{ pages?: RawDocPageV3[] } | RawDocPageV3[]>(
          `/workspaces/${teamId}/docs/${m.id}/pages?content_format=text%2Fmd&max_page_depth=1`,
        );
        const list = Array.isArray(pages) ? pages : (pages.pages ?? []);
        m.summary = overviewFromContent(list.map((p) => p.content ?? "").join("\n\n"));
      } catch {
        // leave summary empty — the card still links to the ClickUp doc
      }
    }),
  );

  return meetings;
}

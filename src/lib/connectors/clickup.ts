import { env } from "@/lib/env";
import type { ConnectorStatus, UnifiedItem } from "@/lib/types";
import { type Connector, notConfigured } from "./connector";

const API = "https://api.clickup.com/api/v2";

async function clickup<T>(path: string): Promise<T> {
  const token = env.CLICKUP_API_TOKEN;
  if (!token) throw new Error("CLICKUP_API_TOKEN not set");

  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: token },
    // ClickUp data changes often; never serve stale.
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

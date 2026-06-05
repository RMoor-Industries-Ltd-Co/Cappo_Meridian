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

    const { tasks } = await clickup<{
      tasks: {
        id: string;
        name: string;
        url: string;
        status?: { status: string };
        date_updated?: string;
      }[];
    }>(`/team/${teamId}/task?order_by=updated&reverse=true&subtasks=true`);

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

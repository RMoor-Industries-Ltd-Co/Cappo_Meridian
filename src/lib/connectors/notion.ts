import { Client } from "@notionhq/client";
import { env } from "@/lib/env";
import type { ConnectorStatus, UnifiedItem } from "@/lib/types";
import { type Connector, notConfigured } from "./connector";

let client: Client | null = null;
function getClient(): Client {
  if (!env.NOTION_API_KEY) throw new Error("NOTION_API_KEY not set");
  if (!client) client = new Client({ auth: env.NOTION_API_KEY });
  return client;
}

/** Best-effort title extraction from a Notion page's properties. */
function pageTitle(page: Record<string, unknown>): string {
  const props = (page.properties ?? {}) as Record<string, unknown>;
  for (const value of Object.values(props)) {
    const v = value as { type?: string; title?: { plain_text: string }[] };
    if (v?.type === "title" && Array.isArray(v.title)) {
      return v.title.map((t) => t.plain_text).join("") || "Untitled";
    }
  }
  return "Untitled";
}

export const notionConnector: Connector = {
  id: "notion",
  name: "Notion",

  isConfigured: () => Boolean(env.NOTION_API_KEY),

  async checkConnection(): Promise<ConnectorStatus> {
    if (!this.isConfigured()) return notConfigured(this.id, this.name);
    try {
      const me = await getClient().users.me({});
      const name = me.name ?? me.id;
      return {
        id: this.id,
        name: this.name,
        configured: true,
        connected: true,
        detail: `Integration: ${name}`,
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
    const res = await getClient().search({
      sort: { direction: "descending", timestamp: "last_edited_time" },
      page_size: limit,
      filter: { property: "object", value: "page" },
    });

    return res.results.map((r) => {
      const page = r as Record<string, unknown>;
      return {
        id: page.id as string,
        source: "notion" as const,
        kind: "doc" as const,
        title: pageTitle(page),
        url: page.url as string | undefined,
        updatedAt: page.last_edited_time as string | undefined,
      };
    });
  },
};

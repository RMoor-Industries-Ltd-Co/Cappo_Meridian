import { google } from "googleapis";
import { isGoogleConfigured } from "@/lib/env";
import type { ConnectorStatus, UnifiedItem } from "@/lib/types";
import { type Connector, notConfigured } from "./connector";
import { getAuthorizedClient } from "./google";

function header(
  headers: { name?: string | null; value?: string | null }[] | undefined,
  name: string,
): string | undefined {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined;
}

export const gmailConnector: Connector = {
  id: "gmail",
  name: "Gmail",

  isConfigured: () => isGoogleConfigured(),

  async checkConnection(): Promise<ConnectorStatus> {
    if (!this.isConfigured()) {
      return notConfigured(this.id, this.name, "Google OAuth not configured");
    }
    const auth = await getAuthorizedClient();
    if (!auth) {
      return {
        id: this.id,
        name: this.name,
        configured: true,
        connected: false,
        detail: "Not connected — authorize Google to enable Gmail",
      };
    }
    try {
      const gmail = google.gmail({ version: "v1", auth });
      const { data } = await gmail.users.getProfile({ userId: "me" });
      return {
        id: this.id,
        name: this.name,
        configured: true,
        connected: true,
        detail: `Connected as ${data.emailAddress} (${data.messagesTotal ?? 0} messages)`,
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
    const auth = await getAuthorizedClient();
    if (!auth) return [];
    const gmail = google.gmail({ version: "v1", auth });

    const list = await gmail.users.messages.list({
      userId: "me",
      maxResults: limit,
      q: "in:inbox",
    });

    const messages = list.data.messages ?? [];
    const items = await Promise.all(
      messages.map(async (m) => {
        const { data } = await gmail.users.messages.get({
          userId: "me",
          id: m.id!,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "Date"],
        });
        const headers = data.payload?.headers ?? undefined;
        return {
          id: m.id!,
          source: "gmail" as const,
          kind: "message" as const,
          title: header(headers, "Subject") ?? "(no subject)",
          url: `https://mail.google.com/mail/u/0/#inbox/${m.id}`,
          updatedAt: data.internalDate
            ? new Date(Number(data.internalDate)).toISOString()
            : undefined,
          meta: { from: header(headers, "From"), snippet: data.snippet },
        } satisfies UnifiedItem;
      }),
    );
    return items;
  },
};

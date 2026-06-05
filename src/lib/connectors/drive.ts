import { google } from "googleapis";
import { isGoogleConfigured } from "@/lib/env";
import type { ConnectorStatus, UnifiedItem } from "@/lib/types";
import { type Connector, notConfigured } from "./connector";
import { getAuthorizedClient } from "./google";

export const driveConnector: Connector = {
  id: "drive",
  name: "Google Drive",

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
        detail: "Not connected — authorize Google to enable Drive",
      };
    }
    try {
      const drive = google.drive({ version: "v3", auth });
      const { data } = await drive.about.get({ fields: "user(emailAddress,displayName)" });
      return {
        id: this.id,
        name: this.name,
        configured: true,
        connected: true,
        detail: `Connected as ${data.user?.emailAddress ?? "unknown"}`,
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
    const drive = google.drive({ version: "v3", auth });
    const { data } = await drive.files.list({
      pageSize: limit,
      orderBy: "modifiedTime desc",
      fields: "files(id,name,webViewLink,modifiedTime,mimeType)",
      q: "trashed = false",
    });

    return (data.files ?? []).map((f) => ({
      id: f.id!,
      source: "drive" as const,
      kind: "file" as const,
      title: f.name ?? "Untitled",
      url: f.webViewLink ?? undefined,
      updatedAt: f.modifiedTime ?? undefined,
      meta: { mimeType: f.mimeType },
    }));
  },
};

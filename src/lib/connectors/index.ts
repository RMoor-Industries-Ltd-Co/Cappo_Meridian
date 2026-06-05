import type { ConnectorStatus, UnifiedItem } from "@/lib/types";
import type { Connector } from "./connector";
import { clickupConnector } from "./clickup";
import { notionConnector } from "./notion";
import { driveConnector } from "./drive";
import { gmailConnector } from "./gmail";

/** The connector registry — single source of truth for all integrations. */
export const connectors: Connector[] = [
  clickupConnector,
  notionConnector,
  driveConnector,
  gmailConnector,
];

export function getConnector(id: string): Connector | undefined {
  return connectors.find((c) => c.id === id);
}

/** Probe every connector's health in parallel. */
export async function getAllStatuses(): Promise<ConnectorStatus[]> {
  return Promise.all(connectors.map((c) => c.checkConnection()));
}

/** Pull recent items from every connector that supports it, merged + sorted. */
export async function getUnifiedFeed(limitPerSource = 15): Promise<UnifiedItem[]> {
  const results = await Promise.allSettled(
    connectors
      .filter((c) => c.listRecent && c.isConfigured())
      .map((c) => c.listRecent!(limitPerSource)),
  );

  const items = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return items.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}

export { type Connector } from "./connector";

import type { ConnectorId, ConnectorStatus, UnifiedItem } from "@/lib/types";

/**
 * Contract every integration implements. Keeps ClickUp, Notion, Drive, and
 * Gmail interchangeable behind a single interface.
 */
export interface Connector {
  readonly id: ConnectorId;
  readonly name: string;

  /** True when the required credentials are present in the environment. */
  isConfigured(): boolean;

  /** Probe the live service and report health. Never throws. */
  checkConnection(): Promise<ConnectorStatus>;

  /** Optional: pull recent items normalized into UnifiedItem[]. */
  listRecent?(limit?: number): Promise<UnifiedItem[]>;
}

/** Helper for connectors to build a consistent "not configured" status. */
export function notConfigured(
  id: ConnectorId,
  name: string,
  detail = "Missing credentials",
): ConnectorStatus {
  return { id, name, configured: false, connected: false, detail };
}

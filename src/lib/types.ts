/**
 * Shared domain model. Each connector maps its native objects (ClickUp tasks,
 * Notion pages, Drive files, Gmail threads) into these common shapes so the UI
 * and API can treat the four services uniformly.
 */

export type ConnectorId = "clickup" | "notion" | "drive" | "gmail";

export type ItemKind = "task" | "doc" | "file" | "message";

/** Result of probing a connector's health. */
export interface ConnectorStatus {
  id: ConnectorId;
  name: string;
  /** Credentials are present in the environment. */
  configured: boolean;
  /** A live API call against the service succeeded. */
  connected: boolean;
  /** Human-readable detail (account email, workspace name, etc.). */
  detail?: string;
  /** Populated when a live check fails. */
  error?: string;
}

/** A normalized work item from any source. */
export interface UnifiedItem {
  id: string;
  source: ConnectorId;
  kind: ItemKind;
  title: string;
  url?: string;
  status?: string;
  updatedAt?: string;
  /** Source-specific fields preserved for detail views. */
  meta?: Record<string, unknown>;
}

import { env, isShopifyConfigured } from "@/lib/env";
import type { ConnectorStatus } from "@/lib/types";
import { type Connector, notConfigured } from "./connector";

/**
 * CAPPO Milestone 5 — Shopify Admin GraphQL API connector.
 *
 * READ-ONLY, by design: this module contains no mutation, and every request
 * function here issues a GraphQL `query`, never a `mutation`. There is
 * intentionally no `createProduct`/`updateInventory`/etc. exported from this
 * file — Phase 2 scope, not this one. See the module doc comment on
 * `shopifyRequest` for the one chokepoint that would need to change if that
 * ever happens, so a future write path can't quietly bypass review here.
 *
 * Matches the plain-`fetch` style of `clickup.ts` rather than adding a new
 * SDK dependency — this repo's established "one connector, one fetch
 * wrapper" convention (no GraphQL client library is currently a dependency).
 */

// Pinned default Admin API version — override via SHOPIFY_API_VERSION to
// upgrade deliberately rather than silently tracking Shopify's latest.
const DEFAULT_API_VERSION = "2025-01";

export class ShopifyConnectorError extends Error {
  readonly code:
    | "NOT_CONFIGURED"
    | "AUTH_FAILED"
    | "RATE_LIMITED"
    | "GRAPHQL_ERROR"
    | "NETWORK_ERROR";
  readonly details?: unknown;

  constructor(code: ShopifyConnectorError["code"], message: string, details?: unknown) {
    super(message);
    this.name = "ShopifyConnectorError";
    this.code = code;
    this.details = details;
  }
}

function apiVersion(): string {
  return env.SHOPIFY_API_VERSION || DEFAULT_API_VERSION;
}

function endpoint(): string {
  if (!env.SHOPIFY_STORE_DOMAIN) {
    throw new ShopifyConnectorError("NOT_CONFIGURED", "SHOPIFY_STORE_DOMAIN not set");
  }
  return `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${apiVersion()}/graphql.json`;
}

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
  extensions?: {
    cost?: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus?: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
};

const MAX_RETRIES = 3;

/**
 * The single chokepoint every Shopify call goes through. Read-only by
 * construction — callers pass a GraphQL document string; this function does
 * not distinguish `query` from `mutation` itself, so if a future phase adds
 * a mutation it MUST go through its own reviewed path, not silently reuse
 * this one unaudited (flagged here, not technically enforced, since GraphQL
 * has no separate "read-only" transport-level marker).
 *
 * Handles Shopify's cost-based rate limiting: when the response reports the
 * query was throttled (or the available "bucket" can't cover the next call),
 * this waits the bucket's restore time and retries, up to MAX_RETRIES.
 */
async function shopifyRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  if (!isShopifyConfigured()) {
    throw new ShopifyConnectorError("NOT_CONFIGURED", "Shopify credentials not set");
  }
  const token = env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;

  let lastError: ShopifyConnectorError | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(endpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({ query, variables }),
        cache: "no-store",
      });
    } catch (err) {
      throw new ShopifyConnectorError(
        "NETWORK_ERROR",
        err instanceof Error ? err.message : String(err),
      );
    }

    if (res.status === 401 || res.status === 403) {
      throw new ShopifyConnectorError(
        "AUTH_FAILED",
        `Shopify rejected the Admin API token (HTTP ${res.status})`,
      );
    }
    if (res.status === 429) {
      lastError = new ShopifyConnectorError("RATE_LIMITED", "Shopify returned HTTP 429");
      await backoff(attempt);
      continue;
    }
    if (!res.ok) {
      throw new ShopifyConnectorError(
        "NETWORK_ERROR",
        `Shopify Admin API → HTTP ${res.status} ${res.statusText}`,
      );
    }

    const json = (await res.json()) as GraphQLResponse<T>;

    const throttled = json.errors?.some((e) => e.extensions?.code === "THROTTLED");
    const bucket = json.extensions?.cost?.throttleStatus;
    const nearlyEmpty =
      bucket !== undefined &&
      json.extensions?.cost &&
      bucket.currentlyAvailable < json.extensions.cost.requestedQueryCost;
    if (throttled || nearlyEmpty) {
      lastError = new ShopifyConnectorError(
        "RATE_LIMITED",
        "Shopify Admin API query cost exceeded the available throttle bucket",
      );
      const waitMs = bucket ? Math.ceil((1000 * 5) / Math.max(bucket.restoreRate, 1)) : 1000;
      await sleep(waitMs);
      continue;
    }

    if (json.errors?.length) {
      throw new ShopifyConnectorError(
        "GRAPHQL_ERROR",
        json.errors.map((e) => e.message).join("; "),
        json.errors,
      );
    }
    if (!json.data) {
      throw new ShopifyConnectorError("GRAPHQL_ERROR", "Shopify response had no data");
    }
    return json.data;
  }

  throw lastError ?? new ShopifyConnectorError("RATE_LIMITED", "Shopify rate limit retries exhausted");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function backoff(attempt: number): Promise<void> {
  await sleep(Math.min(500 * 2 ** attempt, 4000));
}

// ── Typed read-only domain shapes ────────────────────────────────────────────
// `shopifyProductId`/`shopifyVariantId`/`inventoryItemId` are Shopify's own
// GIDs (e.g. "gid://shopify/Product/123") — the safe reconciliation
// identifiers a sync layer keys off, never re-derived or guessed elsewhere.

export interface ShopifyVariant {
  shopifyVariantId: string;
  title: string;
  sku: string | null;
  price: string | null;
  inventoryItemId: string | null;
}

export interface ShopifyProduct {
  shopifyProductId: string;
  title: string;
  handle: string;
  status: string;
  vendor: string | null;
  productType: string | null;
  variants: ShopifyVariant[];
}

export interface ShopifyInventoryLevel {
  inventoryItemId: string;
  locationId: string;
  /** Null means "Shopify did not report a value" — NEVER coerced to 0.
   * A sync layer must treat null as "unknown," not "out of stock." */
  available: number | null;
}

export interface ShopifyLocation {
  locationId: string;
  name: string;
  isActive: boolean;
}

// ── Pagination helper (cursor loop, same shape as Notion's listAllRows) ──────

interface Connection<N> {
  edges: { cursor: string; node: N }[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

async function paginate<N>(
  run: (cursor: string | null) => Promise<Connection<N>>,
): Promise<N[]> {
  const all: N[] = [];
  let cursor: string | null = null;
  let hasNext = true;
  while (hasNext) {
    const page = await run(cursor);
    all.push(...page.edges.map((e) => e.node));
    hasNext = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }
  return all;
}

const PRODUCTS_QUERY = `
  query Products($cursor: String) {
    products(first: 50, after: $cursor) {
      edges {
        cursor
        node {
          id
          title
          handle
          status
          vendor
          productType
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                price
                inventoryItem { id }
              }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

type RawProductNode = {
  id: string;
  title: string;
  handle: string;
  status: string;
  vendor: string | null;
  productType: string | null;
  variants: {
    edges: {
      node: {
        id: string;
        title: string;
        sku: string | null;
        price: string | null;
        inventoryItem: { id: string } | null;
      };
    }[];
  };
};

function mapProduct(node: RawProductNode): ShopifyProduct {
  return {
    shopifyProductId: node.id,
    title: node.title,
    handle: node.handle,
    status: node.status,
    vendor: node.vendor,
    productType: node.productType,
    variants: node.variants.edges.map(({ node: v }) => ({
      shopifyVariantId: v.id,
      title: v.title,
      sku: v.sku,
      price: v.price,
      inventoryItemId: v.inventoryItem?.id ?? null,
    })),
  };
}

/** Read-only: every product + variant, paginated. */
export async function listProducts(): Promise<ShopifyProduct[]> {
  const nodes = await paginate<RawProductNode>(async (cursor) => {
    const data = await shopifyRequest<{
      products: Connection<RawProductNode>;
    }>(PRODUCTS_QUERY, { cursor });
    return data.products;
  });
  return nodes.map(mapProduct);
}

const LOCATIONS_QUERY = `
  query Locations($cursor: String) {
    locations(first: 50, after: $cursor) {
      edges { cursor node { id name isActive } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

/** Read-only: every fulfillment location. */
export async function listLocations(): Promise<ShopifyLocation[]> {
  const nodes = await paginate<{ id: string; name: string; isActive: boolean }>(
    async (cursor) => {
      const data = await shopifyRequest<{
        locations: Connection<{ id: string; name: string; isActive: boolean }>;
      }>(LOCATIONS_QUERY, { cursor });
      return data.locations;
    },
  );
  return nodes.map((n) => ({ locationId: n.id, name: n.name, isActive: n.isActive }));
}

const INVENTORY_LEVELS_QUERY = `
  query InventoryLevelsForItems($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on InventoryItem {
        id
        inventoryLevels(first: 20) {
          edges {
            node {
              location { id }
              quantities(names: ["available"]) { name quantity }
            }
          }
        }
      }
    }
  }
`;

type RawInventoryItemNode = {
  id: string;
  inventoryLevels: {
    edges: {
      node: {
        location: { id: string };
        quantities: { name: string; quantity: number | null }[];
      };
    }[];
  };
} | null;

/**
 * Read-only inventory levels for a batch of inventory item GIDs (Shopify
 * caps `nodes(ids:)` batches — callers should chunk to ~50 ids per call).
 * A missing/unreported quantity stays `null`, never `0` — see
 * `ShopifyInventoryLevel.available`.
 */
export async function listInventoryLevels(
  inventoryItemIds: string[],
): Promise<ShopifyInventoryLevel[]> {
  if (inventoryItemIds.length === 0) return [];
  const data = await shopifyRequest<{ nodes: RawInventoryItemNode[] }>(
    INVENTORY_LEVELS_QUERY,
    { ids: inventoryItemIds },
  );
  const levels: ShopifyInventoryLevel[] = [];
  for (const item of data.nodes) {
    if (!item) continue;
    for (const { node } of item.inventoryLevels.edges) {
      const available = node.quantities.find((q) => q.name === "available")?.quantity;
      levels.push({
        inventoryItemId: item.id,
        locationId: node.location.id,
        available: typeof available === "number" ? available : null,
      });
    }
  }
  return levels;
}

// ── Registry connector (Settings/status page health probe) ──────────────────

export const shopifyConnector: Connector = {
  id: "shopify",
  name: "Shopify",

  isConfigured: () => isShopifyConfigured(),

  async checkConnection(): Promise<ConnectorStatus> {
    if (!this.isConfigured()) return notConfigured(this.id, this.name);
    try {
      const data = await shopifyRequest<{ shop: { name: string; myshopifyDomain: string } }>(
        `query Shop { shop { name myshopifyDomain } }`,
      );
      return {
        id: this.id,
        name: this.name,
        configured: true,
        connected: true,
        detail: `Connected to ${data.shop.name} (${data.shop.myshopifyDomain}), read-only`,
      };
    } catch (err) {
      return {
        id: this.id,
        name: this.name,
        configured: true,
        connected: false,
        error: err instanceof ShopifyConnectorError ? `${err.code}: ${err.message}` : String(err),
      };
    }
  },
};

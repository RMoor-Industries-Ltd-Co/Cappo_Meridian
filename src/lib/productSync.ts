import { isShopifyConfigured, isDbConfigured } from "@/lib/env";
import {
  getGovernedCatalog,
  resolveGovernedProducts,
  isInventoryEligible,
  type ResolvedGovernedProduct,
} from "@/lib/connectors/products";
import {
  listProducts,
  listInventoryLevels,
  ShopifyConnectorError,
  type ShopifyProduct,
  type ShopifyVariant,
} from "@/lib/connectors/shopify";
import {
  upsertProductSyncMapping,
  recordInventorySnapshot,
  createProductSyncRun,
  recordProductSyncFailure,
  recordProductSyncAudit,
} from "@/lib/db";

/**
 * CAPPO Milestone 5 — Notion ↔ Shopify reconciliation.
 *
 * Scope discipline: this ONLY reads Notion and Shopify and WRITES to this
 * app's own Postgres mapping/snapshot tables. It never calls a Shopify
 * mutation and never writes back to Notion — see `src/lib/connectors/shopify.ts`'s
 * doc comment for why that boundary is enforced at the connector layer too.
 *
 * Matching is intentionally conservative: a governed product is matched to a
 * Shopify variant ONLY by an exact SKU value recorded as a "SKU" Product Data
 * attribute in Notion. There is no fuzzy/name-based matching — a wrong
 * automatic match (not a missed one) is the dangerous failure mode for
 * reconciling real inventory, so an unmatched product surfaces as a
 * reconciliation failure to review, never a best-guess link.
 */

export interface ProductSyncResult {
  status: "skipped_no_shopify" | "skipped_no_db" | "success" | "partial" | "failed";
  message: string;
  productsSeen: number;
  mappedCount: number;
  unmappedCount: number;
  reconciliationFailures: number;
  syncRunId: string | null;
}

/** Default staleness threshold for an inventory snapshot — used by the
 * Inventory panel to flag a number that may no longer be trustworthy rather
 * than presenting an old reading as current. Pure/exported so it's directly
 * unit-testable without a database. */
export const DEFAULT_STALE_AFTER_HOURS = 24;

export function isSnapshotStale(
  capturedAtIso: string,
  maxAgeHours: number = DEFAULT_STALE_AFTER_HOURS,
): boolean {
  const capturedAt = new Date(capturedAtIso).getTime();
  if (Number.isNaN(capturedAt)) return true; // an unparsable timestamp is never trustworthy
  return Date.now() - capturedAt > maxAgeHours * 3600_000;
}

function extractSku(product: ResolvedGovernedProduct): string | null {
  const skuRecord = product.productData.find(
    (d) => /\bsku\b/i.test(d.name) && d.value && d.value.trim().length > 0,
  );
  return skuRecord?.value?.trim() || null;
}

function indexShopifyBySku(
  products: ShopifyProduct[],
): { bySku: Map<string, { product: ShopifyProduct; variant: ShopifyVariant }>; duplicateSkus: Set<string> } {
  const bySku = new Map<string, { product: ShopifyProduct; variant: ShopifyVariant }>();
  const duplicateSkus = new Set<string>();
  for (const product of products) {
    for (const variant of product.variants) {
      const sku = variant.sku?.trim();
      if (!sku) continue;
      if (bySku.has(sku)) {
        duplicateSkus.add(sku);
        continue;
      }
      bySku.set(sku, { product, variant });
    }
  }
  return { bySku, duplicateSkus };
}

/**
 * Runs one full reconciliation pass. Idempotent: re-running immediately
 * after a successful run reproduces the same mappings (upserts keyed on
 * Shopify's own variant id) and the same inventory snapshot values — it
 * only ever appends a new snapshot row and updates `matched_at`, never
 * duplicates a mapping.
 */
export async function runProductSync(): Promise<ProductSyncResult> {
  if (!isShopifyConfigured()) {
    return {
      status: "skipped_no_shopify",
      message:
        "Shopify is not configured (SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_API_ACCESS_TOKEN unset) — nothing to reconcile against. Notion-only governed data is still available.",
      productsSeen: 0,
      mappedCount: 0,
      unmappedCount: 0,
      reconciliationFailures: 0,
      syncRunId: null,
    };
  }
  if (!isDbConfigured()) {
    return {
      status: "skipped_no_db",
      message: "DATABASE_URL is not set — sync results have nowhere durable to write.",
      productsSeen: 0,
      mappedCount: 0,
      unmappedCount: 0,
      reconciliationFailures: 0,
      syncRunId: null,
    };
  }

  const catalog = await getGovernedCatalog();
  const resolved = resolveGovernedProducts(catalog);
  const eligible = resolved.filter(isInventoryEligible);

  let shopifyProducts: ShopifyProduct[];
  try {
    shopifyProducts = await listProducts();
  } catch (err) {
    const message =
      err instanceof ShopifyConnectorError ? `${err.code}: ${err.message}` : String(err);
    const run = await createProductSyncRun({
      status: "failed",
      productsSeen: eligible.length,
      mappedCount: 0,
      unmappedCount: eligible.length,
      reconciliationFailures: 1,
      error: message,
    });
    await recordProductSyncFailure({
      syncRunId: run.id,
      subjectType: "shopify_fetch",
      subjectId: "listProducts",
      reason: "shopify_fetch_failed",
      detail: message,
    });
    return {
      status: "failed",
      message: `Shopify fetch failed: ${message}`,
      productsSeen: eligible.length,
      mappedCount: 0,
      unmappedCount: eligible.length,
      reconciliationFailures: 1,
      syncRunId: run.id,
    };
  }

  const { bySku, duplicateSkus } = indexShopifyBySku(shopifyProducts);

  let mappedCount = 0;
  let unmappedCount = 0;
  const failures: { subjectType: string; subjectId: string; reason: string; detail: string | null }[] = [];
  const auditEntries: {
    action: string;
    notionProductId: string | null;
    shopifyVariantId: string | null;
    detail: string | null;
  }[] = [];
  const mappedInventoryItemIds: string[] = [];
  const mappedVariantByInventoryItemId = new Map<string, string>();

  for (const product of eligible) {
    const sku = extractSku(product);
    if (!sku) {
      unmappedCount++;
      failures.push({
        subjectType: "notion_product",
        subjectId: product.notionId,
        reason: "missing_sku",
        detail: `"${product.name}" has no "SKU" Product Data attribute recorded — cannot reconcile against Shopify.`,
      });
      continue;
    }
    if (duplicateSkus.has(sku)) {
      unmappedCount++;
      failures.push({
        subjectType: "notion_product",
        subjectId: product.notionId,
        reason: "duplicate_sku_in_shopify",
        detail: `SKU "${sku}" matches more than one Shopify variant — refusing to guess which one.`,
      });
      continue;
    }
    const match = bySku.get(sku);
    if (!match) {
      unmappedCount++;
      failures.push({
        subjectType: "notion_product",
        subjectId: product.notionId,
        reason: "no_shopify_match",
        detail: `SKU "${sku}" was not found among Shopify's product variants.`,
      });
      continue;
    }

    await upsertProductSyncMapping({
      notionProductId: product.notionId,
      shopifyProductId: match.product.shopifyProductId,
      shopifyVariantId: match.variant.shopifyVariantId,
      sku,
      matchMethod: "sku_exact",
    });
    auditEntries.push({
      action: "mapping_upserted",
      notionProductId: product.notionId,
      shopifyVariantId: match.variant.shopifyVariantId,
      detail: `Matched on SKU "${sku}"`,
    });
    mappedCount++;
    if (match.variant.inventoryItemId) {
      mappedInventoryItemIds.push(match.variant.inventoryItemId);
      mappedVariantByInventoryItemId.set(match.variant.inventoryItemId, match.variant.shopifyVariantId);
    }
  }

  // Inventory snapshots for every successfully-mapped variant that has an
  // inventory item id. Batched to respect Shopify's `nodes(ids:)` cap.
  const BATCH = 50;
  for (let i = 0; i < mappedInventoryItemIds.length; i += BATCH) {
    const batch = mappedInventoryItemIds.slice(i, i + BATCH);
    let levels: Awaited<ReturnType<typeof listInventoryLevels>>;
    try {
      levels = await listInventoryLevels(batch);
    } catch (err) {
      const message =
        err instanceof ShopifyConnectorError ? `${err.code}: ${err.message}` : String(err);
      failures.push({
        subjectType: "shopify_fetch",
        subjectId: "listInventoryLevels",
        reason: "inventory_fetch_failed",
        detail: message,
      });
      continue;
    }
    for (const level of levels) {
      const variantId = mappedVariantByInventoryItemId.get(level.inventoryItemId);
      if (!variantId) continue;
      // `level.available` may legitimately be null — passed through as-is,
      // never defaulted to 0. See recordInventorySnapshot's own contract.
      await recordInventorySnapshot({
        shopifyVariantId: variantId,
        shopifyInventoryItemId: level.inventoryItemId,
        locationId: level.locationId,
        available: level.available,
      });
    }
  }

  const status: ProductSyncResult["status"] = failures.length === 0 ? "success" : "partial";
  const run = await createProductSyncRun({
    status,
    productsSeen: eligible.length,
    mappedCount,
    unmappedCount,
    reconciliationFailures: failures.length,
    error: null,
  });
  for (const f of failures) {
    await recordProductSyncFailure({ syncRunId: run.id, ...f });
  }
  for (const a of auditEntries) {
    await recordProductSyncAudit({ syncRunId: run.id, ...a });
  }

  return {
    status,
    message:
      failures.length === 0
        ? `Reconciled ${mappedCount}/${eligible.length} inventory-eligible products.`
        : `Reconciled ${mappedCount}/${eligible.length} inventory-eligible products; ${failures.length} need attention.`,
    productsSeen: eligible.length,
    mappedCount,
    unmappedCount,
    reconciliationFailures: failures.length,
    syncRunId: run.id,
  };
}

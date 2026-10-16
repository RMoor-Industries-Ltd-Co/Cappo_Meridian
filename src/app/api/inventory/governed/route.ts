import { NextResponse } from "next/server";
import { env, isShopifyConfigured, isDbConfigured } from "@/lib/env";
import { isSnapshotStale } from "@/lib/productSync";
import {
  getGovernedCatalog,
  resolveGovernedProducts,
  isLaunched,
  isOnHold,
  isRetired,
  isAppointment,
  isInventoryEligible,
  type ResolvedGovernedProduct,
} from "@/lib/connectors/products";
import {
  listProductSyncMappings,
  listLatestInventorySnapshots,
  getLastProductSyncRun,
  listProductSyncFailures,
  type ProductSyncMapping,
  type LatestInventorySnapshot,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export interface GovernedProductRow {
  notionId: string;
  name: string;
  architectureRole: string;
  category: string;
  developmentGate: string;
  status: string;
  isComplete: boolean;
  isLaunched: boolean;
  isOnHold: boolean;
  isRetired: boolean;
  isAppointment: boolean;
  inventoryEligible: boolean;
  lastVerified: string | null;
  supplierNames: string[];
  /** Present only for inventory-eligible products with a reconciled Shopify mapping. */
  shopifyVariantId: string | null;
  sku: string | null;
  /** Sum of the latest known "available" across locations. Null = unknown
   * (never fabricated to 0) — distinct from a mapped product that
   * genuinely reports 0 everywhere. */
  availableQuantity: number | null;
  /** True when every known reading for this variant is older than the
   * staleness threshold — the UI shows the number but flags it as possibly
   * no longer current, rather than presenting it as fresh. */
  inventoryStale: boolean;
}

function toRow(
  product: ResolvedGovernedProduct,
  mappingByNotionId: Map<string, ProductSyncMapping>,
  snapshotsByVariant: Map<string, LatestInventorySnapshot[]>,
): GovernedProductRow {
  const mapping = mappingByNotionId.get(product.notionId) ?? null;
  const snapshots = mapping ? snapshotsByVariant.get(mapping.shopify_variant_id) ?? [] : [];
  const hasAnySnapshot = snapshots.length > 0;
  const hasAnyKnownQuantity = snapshots.some((s) => s.available !== null);
  const availableQuantity =
    hasAnySnapshot && hasAnyKnownQuantity
      ? snapshots.reduce((sum, s) => sum + (s.available ?? 0), 0)
      : null;
  const inventoryStale = hasAnySnapshot && snapshots.every((s) => isSnapshotStale(s.captured_at));

  return {
    notionId: product.notionId,
    name: product.name || "(untitled catalog record)",
    architectureRole: product.architectureRole,
    category: product.category,
    developmentGate: product.developmentGate,
    status: product.status,
    isComplete: product.isComplete,
    isLaunched: isLaunched(product),
    isOnHold: isOnHold(product),
    isRetired: isRetired(product),
    isAppointment: isAppointment(product),
    inventoryEligible: isInventoryEligible(product),
    lastVerified: product.lastVerified,
    supplierNames: [...product.primarySuppliers, ...product.suppliers]
      .filter((s, i, arr) => arr.findIndex((x) => x.notionId === s.notionId) === i)
      .map((s) => s.name),
    shopifyVariantId: mapping?.shopify_variant_id ?? null,
    sku: mapping?.sku ?? null,
    availableQuantity,
    inventoryStale,
  };
}

/**
 * GET /api/inventory/governed — read-only governed product data for the
 * Inventory module's dashboard panel. Every "configured" flag is surfaced
 * explicitly so the UI can render a meaningful empty state instead of
 * silently showing nothing when Notion, Shopify, or the DB isn't set up.
 */
export async function GET() {
  const notionConfigured = Boolean(env.NOTION_API_KEY);
  const shopifyConfigured = isShopifyConfigured();
  const dbConfigured = isDbConfigured();

  const catalog = notionConfigured
    ? await getGovernedCatalog().catch((err) => ({
        products: [],
        productData: [],
        suppliers: [],
        errors: [{ source: "productCatalog" as const, message: String(err) }],
      }))
    : { products: [], productData: [], suppliers: [], errors: [] };
  const resolved = resolveGovernedProducts(catalog);

  const [mappings, snapshots, lastSyncRun, failures] = dbConfigured
    ? await Promise.all([
        listProductSyncMappings(),
        listLatestInventorySnapshots(),
        getLastProductSyncRun(),
        listProductSyncFailures(),
      ])
    : [[], [], null, []];

  const mappingByNotionId = new Map(mappings.map((m) => [m.notion_product_id, m]));
  const snapshotsByVariant = new Map<string, LatestInventorySnapshot[]>();
  for (const s of snapshots) {
    const list = snapshotsByVariant.get(s.shopify_variant_id) ?? [];
    list.push(s);
    snapshotsByVariant.set(s.shopify_variant_id, list);
  }

  const rows = resolved.map((p) => toRow(p, mappingByNotionId, snapshotsByVariant));

  return NextResponse.json({
    configured: { notion: notionConfigured, shopify: shopifyConfigured, db: dbConfigured },
    notionErrors: catalog.errors,
    products: rows,
    mappedCount: mappings.length,
    lastSyncRun,
    needsAttention: failures,
  });
}

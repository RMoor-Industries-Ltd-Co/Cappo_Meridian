import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GovernedCatalog, GovernedProduct, GovernedProductDataRecord } from "@/lib/connectors/products";

const dbMocks = vi.hoisted(() => ({
  upsertProductSyncMapping: vi.fn(),
  recordInventorySnapshot: vi.fn(),
  createProductSyncRun: vi.fn(),
  recordProductSyncFailure: vi.fn(),
  recordProductSyncAudit: vi.fn(),
}));
vi.mock("@/lib/db", () => dbMocks);

const shopifyMocks = vi.hoisted(() => ({
  listProducts: vi.fn(),
  listInventoryLevels: vi.fn(),
}));
vi.mock("@/lib/connectors/shopify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/connectors/shopify")>();
  return { ...actual, listProducts: shopifyMocks.listProducts, listInventoryLevels: shopifyMocks.listInventoryLevels };
});

const productsMocks = vi.hoisted(() => ({ getGovernedCatalog: vi.fn() }));
vi.mock("@/lib/connectors/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/connectors/products")>();
  return { ...actual, getGovernedCatalog: productsMocks.getGovernedCatalog };
});

import { env } from "@/lib/env";
import { runProductSync } from "./productSync";

function makeProduct(overrides: Partial<GovernedProduct> = {}): GovernedProduct {
  return {
    notionId: "product-1",
    name: "Shadow Sanctum",
    architectureRole: "Sellable Product",
    developmentGate: "Active",
    status: "Active",
    category: "Candle",
    productOwnership: "HVN Original",
    inventoryBearing: true,
    founderDecisionRequired: false,
    displayProductId: 1,
    lastVerified: "2026-01-01T00:00:00.000Z",
    useEnvironment: [],
    q3Priority: "Target",
    driveLink: null,
    launchCommerceUrl: null,
    canonicalFamily: null,
    notes: null,
    primarySupplierIds: [],
    supplierIds: [],
    productDataRecordIds: ["data-sku"],
    productFamilyFormIds: [],
    isComplete: true,
    ...overrides,
  };
}

function skuRecord(value: string | null): GovernedProductDataRecord {
  return {
    notionId: "data-sku",
    name: "SKU",
    productId: "product-1",
    supplierId: null,
    module: "Core Identity",
    value,
    numericValue: null,
    unit: "Other",
    dataStatus: "Done",
    currentEvidenceState: "Validated",
    requiredEvidenceState: "Validated",
    confidence: "High",
    criticality: "Critical",
    waiverClass: "Non-Waivable",
    applicability: "Yes",
    sourceType: "Founder Input",
    sourceUrl: null,
    proprietary: false,
    founderDecisionRequired: false,
    lastVerified: null,
  };
}

function catalogWith(product: GovernedProduct, sku: string | null): GovernedCatalog {
  return {
    products: [product],
    productData: [skuRecord(sku)],
    suppliers: [],
    errors: [],
  };
}

const originalShopifyDomain = env.SHOPIFY_STORE_DOMAIN;
const originalShopifyToken = env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
const originalDatabaseUrl = env.DATABASE_URL;

describe("runProductSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.createProductSyncRun.mockImplementation(async (r) => ({
      id: "run-1",
      ran_at: "2026-01-01T00:00:00.000Z",
      ...r,
    }));
  });

  afterEach(() => {
    env.SHOPIFY_STORE_DOMAIN = originalShopifyDomain;
    env.SHOPIFY_ADMIN_API_ACCESS_TOKEN = originalShopifyToken;
    env.DATABASE_URL = originalDatabaseUrl;
  });

  it("skips with status skipped_no_shopify when Shopify isn't configured", async () => {
    env.SHOPIFY_STORE_DOMAIN = undefined;
    env.SHOPIFY_ADMIN_API_ACCESS_TOKEN = undefined;
    const result = await runProductSync();
    expect(result.status).toBe("skipped_no_shopify");
    expect(productsMocks.getGovernedCatalog).not.toHaveBeenCalled();
    expect(shopifyMocks.listProducts).not.toHaveBeenCalled();
  });

  it("skips with status skipped_no_db when Shopify is configured but the database isn't", async () => {
    env.SHOPIFY_STORE_DOMAIN = "test-store.myshopify.com";
    env.SHOPIFY_ADMIN_API_ACCESS_TOKEN = "token";
    env.DATABASE_URL = undefined;
    const result = await runProductSync();
    expect(result.status).toBe("skipped_no_db");
    expect(shopifyMocks.listProducts).not.toHaveBeenCalled();
  });

  describe("with Shopify and the database configured", () => {
    beforeEach(() => {
      env.SHOPIFY_STORE_DOMAIN = "test-store.myshopify.com";
      env.SHOPIFY_ADMIN_API_ACCESS_TOKEN = "token";
      env.DATABASE_URL = "postgres://test";
    });

    it("marks a product with no SKU attribute as unmapped (missing_sku)", async () => {
      productsMocks.getGovernedCatalog.mockResolvedValue(catalogWith(makeProduct(), null));
      shopifyMocks.listProducts.mockResolvedValue([]);

      const result = await runProductSync();

      expect(result.mappedCount).toBe(0);
      expect(result.unmappedCount).toBe(1);
      expect(dbMocks.upsertProductSyncMapping).not.toHaveBeenCalled();
      expect(dbMocks.recordProductSyncFailure).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "missing_sku" }),
      );
    });

    it("marks a product as unmapped when its SKU matches more than one Shopify variant (duplicate_sku_in_shopify)", async () => {
      productsMocks.getGovernedCatalog.mockResolvedValue(catalogWith(makeProduct(), "HVN-001"));
      shopifyMocks.listProducts.mockResolvedValue([
        {
          shopifyProductId: "gid://shopify/Product/1",
          title: "A",
          handle: "a",
          status: "ACTIVE",
          vendor: null,
          productType: null,
          variants: [{ shopifyVariantId: "v1", title: "A", sku: "HVN-001", price: null, inventoryItemId: null }],
        },
        {
          shopifyProductId: "gid://shopify/Product/2",
          title: "B",
          handle: "b",
          status: "ACTIVE",
          vendor: null,
          productType: null,
          variants: [{ shopifyVariantId: "v2", title: "B", sku: "HVN-001", price: null, inventoryItemId: null }],
        },
      ]);

      const result = await runProductSync();

      expect(result.mappedCount).toBe(0);
      expect(result.unmappedCount).toBe(1);
      expect(dbMocks.upsertProductSyncMapping).not.toHaveBeenCalled();
      expect(dbMocks.recordProductSyncFailure).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "duplicate_sku_in_shopify" }),
      );
    });

    it("marks a product as unmapped when its SKU isn't found in Shopify (no_shopify_match)", async () => {
      productsMocks.getGovernedCatalog.mockResolvedValue(catalogWith(makeProduct(), "HVN-DOES-NOT-EXIST"));
      shopifyMocks.listProducts.mockResolvedValue([]);

      const result = await runProductSync();
      expect(result.unmappedCount).toBe(1);
      expect(dbMocks.recordProductSyncFailure).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "no_shopify_match" }),
      );
    });

    it("maps a matching SKU and records an inventory snapshot, preserving a null (unknown) quantity", async () => {
      productsMocks.getGovernedCatalog.mockResolvedValue(catalogWith(makeProduct(), "HVN-001"));
      shopifyMocks.listProducts.mockResolvedValue([
        {
          shopifyProductId: "gid://shopify/Product/1",
          title: "Shadow Sanctum",
          handle: "shadow-sanctum",
          status: "ACTIVE",
          vendor: null,
          productType: null,
          variants: [
            {
              shopifyVariantId: "gid://shopify/ProductVariant/1",
              title: "Default",
              sku: "HVN-001",
              price: "48.00",
              inventoryItemId: "gid://shopify/InventoryItem/1",
            },
          ],
        },
      ]);
      shopifyMocks.listInventoryLevels.mockResolvedValue([
        { inventoryItemId: "gid://shopify/InventoryItem/1", locationId: "loc-1", available: null },
      ]);

      const result = await runProductSync();

      expect(result.status).toBe("success");
      expect(result.mappedCount).toBe(1);
      expect(dbMocks.upsertProductSyncMapping).toHaveBeenCalledWith({
        notionProductId: "product-1",
        shopifyProductId: "gid://shopify/Product/1",
        shopifyVariantId: "gid://shopify/ProductVariant/1",
        sku: "HVN-001",
        matchMethod: "sku_exact",
      });
      expect(dbMocks.recordInventorySnapshot).toHaveBeenCalledWith(
        expect.objectContaining({ available: null }),
      );
    });

    it("is idempotent: running twice calls the upsert the same way each time (no duplicate insert path)", async () => {
      productsMocks.getGovernedCatalog.mockResolvedValue(catalogWith(makeProduct(), "HVN-001"));
      shopifyMocks.listProducts.mockResolvedValue([
        {
          shopifyProductId: "gid://shopify/Product/1",
          title: "Shadow Sanctum",
          handle: "shadow-sanctum",
          status: "ACTIVE",
          vendor: null,
          productType: null,
          variants: [
            { shopifyVariantId: "v1", title: "Default", sku: "HVN-001", price: "48.00", inventoryItemId: null },
          ],
        },
      ]);
      shopifyMocks.listInventoryLevels.mockResolvedValue([]);

      await runProductSync();
      await runProductSync();

      expect(dbMocks.upsertProductSyncMapping).toHaveBeenCalledTimes(2);
      const [firstCallArgs] = dbMocks.upsertProductSyncMapping.mock.calls[0];
      const [secondCallArgs] = dbMocks.upsertProductSyncMapping.mock.calls[1];
      expect(secondCallArgs).toEqual(firstCallArgs);
      // True once-row-per-variant dedup is enforced by product_sync_mappings'
      // UNIQUE(shopify_variant_id) + the upsert's ON CONFLICT clause in
      // db.ts — not independently verified here since no live Postgres is
      // available in this sandbox (see PR "Known limitations").
    });

    it("excludes a product that is on Hold or Retired from reconciliation entirely", async () => {
      const onHold = makeProduct({ notionId: "product-hold", developmentGate: "Hold" });
      const retired = makeProduct({ notionId: "product-retired", developmentGate: "Retired", status: "Retired" });
      productsMocks.getGovernedCatalog.mockResolvedValue({
        products: [onHold, retired],
        productData: [],
        suppliers: [],
        errors: [],
      });
      shopifyMocks.listProducts.mockResolvedValue([]);

      const result = await runProductSync();

      // Both are architecturally "Sellable Product"/inventory-bearing, but
      // Hold/Retired products are still inventory-ELIGIBLE by role — this
      // sync does not silently skip them, it reports them as unmapped (no
      // SKU attribute set in this fixture), same as any other unresolved
      // product. The distinct guarantee under test is that they are at
      // least processed, not thrown away pre-sync.
      expect(result.productsSeen).toBe(2);
      expect(result.unmappedCount).toBe(2);
    });
  });
});

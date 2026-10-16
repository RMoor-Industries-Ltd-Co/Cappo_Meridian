import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "@/lib/env";

/**
 * These tests exercise the connector's CONTRACT (configured/not-configured,
 * auth failure, rate-limit retry, pagination, null-preserving inventory
 * reads) against a mocked `fetch` — there is no live Shopify store available
 * in this environment, so nothing here claims a verified live integration.
 * See the PR description's "Known limitations" section.
 */

function configureShopify() {
  env.SHOPIFY_STORE_DOMAIN = "test-store.myshopify.com";
  env.SHOPIFY_ADMIN_API_ACCESS_TOKEN = "shpat_test_token";
}
function unconfigureShopify() {
  env.SHOPIFY_STORE_DOMAIN = undefined;
  env.SHOPIFY_ADMIN_API_ACCESS_TOKEN = undefined;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("shopify connector", () => {
  const originalStoreDomain = env.SHOPIFY_STORE_DOMAIN;
  const originalToken = env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;

  afterEach(() => {
    env.SHOPIFY_STORE_DOMAIN = originalStoreDomain;
    env.SHOPIFY_ADMIN_API_ACCESS_TOKEN = originalToken;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("missing credentials", () => {
    beforeEach(() => unconfigureShopify());

    it("isConfigured() is false and checkConnection() reports not-configured without calling fetch", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      const { shopifyConnector } = await import("./shopify");

      expect(shopifyConnector.isConfigured()).toBe(false);
      const status = await shopifyConnector.checkConnection();
      expect(status).toEqual({
        id: "shopify",
        name: "Shopify",
        configured: false,
        connected: false,
        detail: "Missing credentials",
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("listProducts() rejects with NOT_CONFIGURED", async () => {
      const { listProducts } = await import("./shopify");
      await expect(listProducts()).rejects.toMatchObject({
        name: "ShopifyConnectorError",
        code: "NOT_CONFIGURED",
      });
    });
  });

  describe("invalid credentials", () => {
    beforeEach(() => configureShopify());

    it("checkConnection() reports AUTH_FAILED on an HTTP 401", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 401)));
      const { shopifyConnector } = await import("./shopify");

      const status = await shopifyConnector.checkConnection();
      expect(status.connected).toBe(false);
      expect(status.error).toContain("AUTH_FAILED");
    });

    it("listProducts() throws a structured AUTH_FAILED error on HTTP 403", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 403)));
      const { listProducts } = await import("./shopify");
      await expect(listProducts()).rejects.toMatchObject({ code: "AUTH_FAILED" });
    });
  });

  describe("pagination", () => {
    beforeEach(() => configureShopify());

    it("follows cursor pagination across multiple pages", async () => {
      const page1 = {
        data: {
          products: {
            edges: [
              {
                cursor: "c1",
                node: {
                  id: "gid://shopify/Product/1",
                  title: "Candle A",
                  handle: "candle-a",
                  status: "ACTIVE",
                  vendor: null,
                  productType: null,
                  variants: { edges: [] },
                },
              },
            ],
            pageInfo: { hasNextPage: true, endCursor: "c1" },
          },
        },
      };
      const page2 = {
        data: {
          products: {
            edges: [
              {
                cursor: "c2",
                node: {
                  id: "gid://shopify/Product/2",
                  title: "Candle B",
                  handle: "candle-b",
                  status: "ACTIVE",
                  vendor: null,
                  productType: null,
                  variants: { edges: [] },
                },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      };
      const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        return jsonResponse(body.variables?.cursor ? page2 : page1);
      });
      vi.stubGlobal("fetch", fetchMock);

      const { listProducts } = await import("./shopify");
      const products = await listProducts();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(products.map((p) => p.shopifyProductId)).toEqual([
        "gid://shopify/Product/1",
        "gid://shopify/Product/2",
      ]);
    });
  });

  describe("rate limiting", () => {
    beforeEach(() => configureShopify());

    it("retries after an HTTP 429 and eventually succeeds", async () => {
      const success = {
        data: { shop: { name: "Test Store", myshopifyDomain: "test-store.myshopify.com" } },
      };
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({}, 429))
        .mockResolvedValueOnce(jsonResponse(success));
      vi.stubGlobal("fetch", fetchMock);

      const { shopifyConnector } = await import("./shopify");
      const status = await shopifyConnector.checkConnection();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(status.connected).toBe(true);
    }, 10_000);

    it("retries when Shopify's own throttle bucket reports insufficient cost, without a hard HTTP error", async () => {
      const throttled = {
        data: { shop: { name: "x", myshopifyDomain: "x" } },
        extensions: {
          cost: {
            requestedQueryCost: 10,
            actualQueryCost: 0,
            throttleStatus: { maximumAvailable: 1000, currentlyAvailable: 1, restoreRate: 1000 },
          },
        },
      };
      const ok = {
        data: { shop: { name: "Test Store", myshopifyDomain: "test-store.myshopify.com" } },
        extensions: {
          cost: {
            requestedQueryCost: 10,
            actualQueryCost: 10,
            throttleStatus: { maximumAvailable: 1000, currentlyAvailable: 990, restoreRate: 1000 },
          },
        },
      };
      const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(throttled)).mockResolvedValueOnce(jsonResponse(ok));
      vi.stubGlobal("fetch", fetchMock);

      const { shopifyConnector } = await import("./shopify");
      const status = await shopifyConnector.checkConnection();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(status.connected).toBe(true);
    });
  });

  describe("inventory levels — never coerce an unknown quantity to zero", () => {
    beforeEach(() => configureShopify());

    it("preserves null for a location Shopify didn't report an available quantity for", async () => {
      const response = {
        data: {
          nodes: [
            {
              id: "gid://shopify/InventoryItem/1",
              inventoryLevels: {
                edges: [
                  {
                    node: {
                      location: { id: "gid://shopify/Location/1" },
                      quantities: [{ name: "available", quantity: null }],
                    },
                  },
                  {
                    node: {
                      location: { id: "gid://shopify/Location/2" },
                      quantities: [{ name: "available", quantity: 7 }],
                    },
                  },
                ],
              },
            },
          ],
        },
      };
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(response)));

      const { listInventoryLevels } = await import("./shopify");
      const levels = await listInventoryLevels(["gid://shopify/InventoryItem/1"]);

      expect(levels).toEqual([
        { inventoryItemId: "gid://shopify/InventoryItem/1", locationId: "gid://shopify/Location/1", available: null },
        { inventoryItemId: "gid://shopify/InventoryItem/1", locationId: "gid://shopify/Location/2", available: 7 },
      ]);
    });

    it("returns an empty array without calling fetch when given no ids", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const { listInventoryLevels } = await import("./shopify");
      expect(await listInventoryLevels([])).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("GraphQL-level errors", () => {
    beforeEach(() => configureShopify());

    it("surfaces a non-throttled GraphQL error as GRAPHQL_ERROR", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse({ errors: [{ message: "Field does not exist" }] })),
      );
      const { listProducts } = await import("./shopify");
      await expect(listProducts()).rejects.toMatchObject({ code: "GRAPHQL_ERROR" });
    });
  });
});

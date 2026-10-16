import { describe, expect, it } from "vitest";
import {
  resolveGovernedProducts,
  governedProductsForSupplier,
  isLaunched,
  isOnHold,
  isRetired,
  isInventoryEligible,
  isAppointment,
  mapProduct,
  type GovernedCatalog,
  type GovernedProduct,
  type GovernedSupplier,
  type GovernedProductDataRecord,
  type NRow,
} from "./products";

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
    productDataRecordIds: [],
    productFamilyFormIds: [],
    isComplete: true,
    ...overrides,
  };
}

function makeSupplier(overrides: Partial<GovernedSupplier> = {}): GovernedSupplier {
  return {
    notionId: "supplier-1",
    name: "Four Hands",
    vendorType: ["Manufacturer"],
    vendorClass: "Primary",
    relationshipStatus: "Qualified",
    qualificationStatus: "Qualified",
    feasibilityStatus: "Confirmed",
    riskLevel: "Low",
    confidentialityStatus: "Not Required",
    insuranceStatus: "Confirmed",
    primaryContact: null,
    contactTitle: null,
    email: null,
    phone: null,
    website: null,
    cityRegion: null,
    country: null,
    generalMoq: null,
    indicativeUnitCost: null,
    paymentTerms: null,
    typicalLeadTime: null,
    relatedProductIds: [],
    lastVerified: null,
    isComplete: true,
    ...overrides,
  };
}

function makeCatalog(overrides: Partial<GovernedCatalog> = {}): GovernedCatalog {
  return { products: [], productData: [], suppliers: [], errors: [], ...overrides };
}

describe("resolveGovernedProducts", () => {
  it("joins product data and suppliers by Notion page id", () => {
    const supplier = makeSupplier();
    const dataRecord: GovernedProductDataRecord = {
      notionId: "data-1",
      name: "SKU",
      productId: "product-1",
      supplierId: null,
      module: "Core Identity",
      value: "HVN-SHADOW-01",
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
    const product = makeProduct({
      primarySupplierIds: ["supplier-1"],
      supplierIds: ["supplier-1"],
      productDataRecordIds: ["data-1"],
    });
    const catalog = makeCatalog({ products: [product], suppliers: [supplier], productData: [dataRecord] });

    const [resolved] = resolveGovernedProducts(catalog);
    expect(resolved.primarySuppliers).toHaveLength(1);
    expect(resolved.primarySuppliers[0].name).toBe("Four Hands");
    expect(resolved.suppliers).toHaveLength(1);
    expect(resolved.productData).toHaveLength(1);
    expect(resolved.productData[0].value).toBe("HVN-SHADOW-01");
  });

  it("resolves to empty arrays when a relation points at a row that failed to fetch (empty supplier database)", () => {
    // A product references supplier-1, but the suppliers source came back
    // empty (e.g. that source's query failed, or no suppliers exist yet).
    const product = makeProduct({ primarySupplierIds: ["supplier-1"], supplierIds: ["supplier-1"] });
    const catalog = makeCatalog({ products: [product], suppliers: [] });

    const [resolved] = resolveGovernedProducts(catalog);
    expect(resolved.primarySuppliers).toEqual([]);
    expect(resolved.suppliers).toEqual([]);
    // The product itself is still returned, not dropped.
    expect(resolved.name).toBe("Shadow Sanctum");
  });

  it("returns an empty list for an empty catalog without throwing", () => {
    expect(resolveGovernedProducts(makeCatalog())).toEqual([]);
  });
});

describe("mapProduct — real Notion-row parsing, missing/incomplete values", () => {
  function row(properties: NRow["properties"]): NRow {
    return { id: "row-1", properties };
  }

  it("a row with no title property maps to an incomplete, un-dropped record (never fabricated)", () => {
    const mapped = mapProduct(
      row({
        "Architecture Role": { select: { name: "Sellable Product" } },
        Status: { select: { name: "Active" } },
      }),
    );
    expect(mapped.name).toBe("");
    expect(mapped.isComplete).toBe(false);
    // Still returned with its real Notion id, not silently dropped.
    expect(mapped.notionId).toBe("row-1");
  });

  it("an unrecognized/unset Architecture Role maps to 'Unspecified', not a guessed role", () => {
    const mapped = mapProduct(
      row({
        Name: { title: [{ plain_text: "Mystery Item" }] },
        Status: { select: { name: "Active" } },
      }),
    );
    expect(mapped.architectureRole).toBe("Unspecified");
    expect(mapped.isComplete).toBe(false);
  });

  it("a fully-populated row maps to a complete record", () => {
    const mapped = mapProduct(
      row({
        Name: { title: [{ plain_text: "Shadow Sanctum" }] },
        "Architecture Role": { select: { name: "Sellable Product" } },
        Status: { select: { name: "Active" } },
        "Inventory Bearing": { checkbox: true },
      }),
    );
    expect(mapped.isComplete).toBe(true);
    expect(mapped.inventoryBearing).toBe(true);
  });

  it("a date property left unset maps to null, never today's date or an empty string", () => {
    const mapped = mapProduct(row({ Name: { title: [{ plain_text: "X" }] } }));
    expect(mapped.lastVerified).toBeNull();
  });

  it("an unset checkbox defaults to false, matching Notion's own semantics (unset = unchecked)", () => {
    const mapped = mapProduct(row({ Name: { title: [{ plain_text: "X" }] } }));
    expect(mapped.founderDecisionRequired).toBe(false);
  });
});

describe("launch-status helpers — never assume, only explicit Notion state", () => {
  it("is launched only when status is Active AND gate is Launch Ready/Active", () => {
    expect(isLaunched(makeProduct({ status: "Active", developmentGate: "Active" }))).toBe(true);
    expect(isLaunched(makeProduct({ status: "Active", developmentGate: "Launch Ready" }))).toBe(true);
  });

  it("is NOT launched when gate is still in development, even if status says Active", () => {
    expect(isLaunched(makeProduct({ status: "Active", developmentGate: "Gate 2 — Vendor Confirmed" }))).toBe(
      false,
    );
  });

  it("is NOT launched when status and gate are both simply unset", () => {
    expect(isLaunched(makeProduct({ status: "", developmentGate: "" }))).toBe(false);
  });

  it("recognizes Hold and Retired independently of status", () => {
    expect(isOnHold(makeProduct({ developmentGate: "Hold" }))).toBe(true);
    expect(isRetired(makeProduct({ developmentGate: "Retired" }))).toBe(true);
    expect(isRetired(makeProduct({ status: "Retired", developmentGate: "Active" }))).toBe(true);
  });

  it("a Hold product is not simultaneously reported as launched", () => {
    const product = makeProduct({ status: "Active", developmentGate: "Hold" });
    expect(isOnHold(product)).toBe(true);
    expect(isLaunched(product)).toBe(false);
  });
});

describe("isInventoryEligible / isAppointment", () => {
  it("only a Sellable Product with Inventory Bearing set is eligible", () => {
    expect(isInventoryEligible(makeProduct({ architectureRole: "Sellable Product", inventoryBearing: true }))).toBe(
      true,
    );
    expect(isInventoryEligible(makeProduct({ architectureRole: "Sellable Product", inventoryBearing: false }))).toBe(
      false,
    );
    expect(isInventoryEligible(makeProduct({ architectureRole: "Family", inventoryBearing: true }))).toBe(false);
  });

  it("recognizes Appointments distinctly from sellable products", () => {
    expect(isAppointment(makeProduct({ architectureRole: "Appointment" }))).toBe(true);
    expect(isAppointment(makeProduct({ architectureRole: "Sellable Product" }))).toBe(false);
  });
});

describe("governedProductsForSupplier — Contact Center approval gate", () => {
  it("returns nothing for an unknown supplier name", () => {
    const catalog = makeCatalog({ suppliers: [makeSupplier()] });
    expect(governedProductsForSupplier(catalog, "Nonexistent Co")).toEqual([]);
  });

  it("matches supplier names case-insensitively", () => {
    const supplier = makeSupplier({ name: "Four Hands" });
    const product = makeProduct({ primarySupplierIds: ["supplier-1"] });
    const catalog = makeCatalog({ products: [product], suppliers: [supplier] });
    expect(governedProductsForSupplier(catalog, "FOUR HANDS").length).toBe(1);
  });

  it("withholds a product missing a verification date (never-verified = not approved)", () => {
    const supplier = makeSupplier();
    const product = makeProduct({ primarySupplierIds: ["supplier-1"], lastVerified: null });
    const catalog = makeCatalog({ products: [product], suppliers: [supplier] });
    expect(governedProductsForSupplier(catalog, "Four Hands")).toEqual([]);
  });

  it("withholds a product with a pending founder decision", () => {
    const supplier = makeSupplier();
    const product = makeProduct({ primarySupplierIds: ["supplier-1"], founderDecisionRequired: true });
    const catalog = makeCatalog({ products: [product], suppliers: [supplier] });
    expect(governedProductsForSupplier(catalog, "Four Hands")).toEqual([]);
  });

  it("withholds a Retired or On Hold product even if otherwise complete and verified", () => {
    const supplier = makeSupplier();
    const retired = makeProduct({ primarySupplierIds: ["supplier-1"], developmentGate: "Retired" });
    const onHold = makeProduct({ notionId: "product-2", primarySupplierIds: ["supplier-1"], developmentGate: "Hold" });
    const catalog = makeCatalog({ products: [retired, onHold], suppliers: [supplier] });
    expect(governedProductsForSupplier(catalog, "Four Hands")).toEqual([]);
  });

  it("withholds an incomplete product (stale/missing data)", () => {
    const supplier = makeSupplier();
    const incomplete = makeProduct({
      primarySupplierIds: ["supplier-1"],
      name: "",
      isComplete: false,
    });
    const catalog = makeCatalog({ products: [incomplete], suppliers: [supplier] });
    expect(governedProductsForSupplier(catalog, "Four Hands")).toEqual([]);
  });

  it("surfaces a product only once it is complete, verified, and not on hold/retired/pending", () => {
    const supplier = makeSupplier();
    const approved = makeProduct({ primarySupplierIds: ["supplier-1"] });
    const catalog = makeCatalog({ products: [approved], suppliers: [supplier] });
    const result = governedProductsForSupplier(catalog, "Four Hands");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Shadow Sanctum");
    expect(result[0].lastVerified).toBe("2026-01-01T00:00:00.000Z");
  });
});

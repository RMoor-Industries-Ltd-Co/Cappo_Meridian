import { Client } from "@notionhq/client";
import { env } from "@/lib/env";
import { GOVERNED_PRODUCT_DS } from "@/lib/notionSchema";

/**
 * CAPPO Milestone 5 — governed product data layer.
 *
 * Notion ("the three authoritative sources" in GOVERNED_PRODUCT_DS) is the
 * single authority for product identity, specifications, and supplier
 * relationships. This module never fabricates a value Notion doesn't have:
 * every field that can be legitimately unknown is typed as `| null` (not
 * defaulted to an empty-looking value that could be mistaken for "confirmed
 * empty"), and `isComplete`/`warnings` on each row say plainly when a record
 * is incomplete rather than silently dropping or guessing at it.
 *
 * Modeled on `src/lib/connectors/lexicon.ts`'s pagination + loose
 * property-accessor pattern (same reasons: Notion schemas drift, and a
 * single shared Client keeps one source of truth for auth).
 */

// ── Notion client (shared pattern with lexicon.ts) ──────────────────────────

let client: Client | null = null;
function getClient(): Client {
  if (!env.NOTION_API_KEY) throw new Error("NOTION_API_KEY not set");
  if (!client) client = new Client({ auth: env.NOTION_API_KEY });
  return client;
}

// Exported for test fixtures (see products.test.ts) — these mirror the
// subset of Notion's page/property shape this module actually reads.
export type RichTextToken = { plain_text: string };
export type NProp = {
  type?: string;
  title?: RichTextToken[];
  rich_text?: RichTextToken[];
  select?: { name: string } | null;
  status?: { name: string } | null;
  multi_select?: { name: string }[];
  number?: number | null;
  checkbox?: boolean;
  url?: string | null;
  email?: string | null;
  phone_number?: string | null;
  date?: { start: string; end?: string | null } | null;
  relation?: { id: string }[];
  unique_id?: { number: number | null; prefix?: string | null } | null;
};
export type NRow = {
  id: string;
  properties: Record<string, NProp>;
};

type QueryArgs = Parameters<Client["dataSources"]["query"]>[0];

/** Fetch all rows from a data source, handling Notion cursor pagination. */
async function listAllRows(dataSourceId: string): Promise<NRow[]> {
  const results: NRow[] = [];
  let cursor: string | undefined;
  do {
    const res = await getClient().dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    } as QueryArgs);
    results.push(...(res.results as unknown as NRow[]));
    cursor = res.next_cursor ?? undefined;
  } while (cursor);
  return results;
}

function propByName(row: NRow, names: string[]): NProp | undefined {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  for (const [key, value] of Object.entries(row.properties)) {
    const normalized = key.toLowerCase().replace(/[_-]/g, " ").trim();
    if (wanted.has(normalized)) return value;
  }
  return undefined;
}

const joinRt = (rt: RichTextToken[]) => rt.map((t) => t.plain_text).join("").trim();

function titleAny(row: NRow, names: string[]): string {
  const named = propByName(row, names);
  if (named?.title) return joinRt(named.title);
  const firstTitle = Object.values(row.properties).find((p) => p.type === "title" && p.title);
  return firstTitle?.title ? joinRt(firstTitle.title) : "";
}

function textAny(row: NRow, names: string[]): string {
  const prop = propByName(row, names);
  if (!prop) return "";
  if (prop.rich_text) return joinRt(prop.rich_text);
  if (prop.title) return joinRt(prop.title);
  if (prop.select?.name) return prop.select.name;
  if (prop.status?.name) return prop.status.name;
  if (prop.multi_select?.length) return prop.multi_select.map((v) => v.name).join(", ");
  if (prop.url) return prop.url;
  if (typeof prop.number === "number") return String(prop.number);
  if (typeof prop.checkbox === "boolean") return prop.checkbox ? "true" : "false";
  return "";
}

/** Like textAny, but returns null (not "") when the property is genuinely unset —
 * for fields where "unknown" and "confirmed empty string" must stay distinguishable. */
function textOrNull(row: NRow, names: string[]): string | null {
  const value = textAny(row, names);
  return value === "" ? null : value;
}

function urlOrNull(row: NRow, names: string[]): string | null {
  const prop = propByName(row, names);
  return prop?.url || null;
}

function checkboxAny(row: NRow, names: string[]): boolean {
  const prop = propByName(row, names);
  return prop?.checkbox === true;
}

function multiSelectAny(row: NRow, names: string[]): string[] {
  const prop = propByName(row, names);
  return prop?.multi_select?.map((v) => v.name) ?? [];
}

function numberAny(row: NRow, names: string[]): number | null {
  const prop = propByName(row, names);
  if (typeof prop?.number === "number") return prop.number;
  if (typeof prop?.unique_id?.number === "number") return prop.unique_id.number;
  return null;
}

/** ISO date string (start of range) or null — never fabricated. */
function dateAny(row: NRow, names: string[]): string | null {
  const prop = propByName(row, names);
  return prop?.date?.start ?? null;
}

/** Related page ids (Notion relation property) — the original Notion record IDs. */
function relationIds(row: NRow, names: string[]): string[] {
  const prop = propByName(row, names);
  return prop?.relation?.map((r) => r.id) ?? [];
}

// ── Typed domain shapes ──────────────────────────────────────────────────────

/**
 * Mirrors the "Official Product Catalog" Architecture Role select exactly.
 * "Unspecified" is a real, representable state — it means Notion has no
 * value set, not "assume Sellable Product".
 */
export type ArchitectureRole =
  | "Family"
  | "Variation / Form"
  | "Sellable Product"
  | "Appointment"
  | "Unspecified";

const ARCHITECTURE_ROLES = new Set<ArchitectureRole>([
  "Family",
  "Variation / Form",
  "Sellable Product",
  "Appointment",
]);

function architectureRoleOf(row: NRow): ArchitectureRole {
  const raw = textAny(row, ["architecture role"]);
  return ARCHITECTURE_ROLES.has(raw as ArchitectureRole) ? (raw as ArchitectureRole) : "Unspecified";
}

export interface GovernedProduct {
  /** Notion page id — the canonical, stable identity for this catalog record. */
  notionId: string;
  name: string;
  architectureRole: ArchitectureRole;
  /** Raw Development Gate value (e.g. "Gate 2 — Vendor Confirmed", "Hold", "Retired").
   * Never collapsed into a boolean "launched" flag here — see `isLaunched()`. */
  developmentGate: string;
  status: string;
  category: string;
  productOwnership: string;
  /** Whether this record even carries inventory (Shopify/warehouse reconciliation
   * is meaningless for non-inventory-bearing records like Appointments). */
  inventoryBearing: boolean;
  founderDecisionRequired: boolean;
  /** Human-facing sequential id ("Product ID" in Notion) — display only, never
   * the join key (use `notionId` for that; this can be reassigned by Notion). */
  displayProductId: number | null;
  lastVerified: string | null;
  useEnvironment: string[];
  q3Priority: string;
  driveLink: string | null;
  launchCommerceUrl: string | null;
  canonicalFamily: string | null;
  notes: string | null;
  primarySupplierIds: string[];
  supplierIds: string[];
  productDataRecordIds: string[];
  productFamilyFormIds: string[];
  /** False when the record is missing a name or has no Architecture Role /
   * Status set — i.e. not yet usable for a customer-facing or commerce
   * surface. Never hidden from the caller; surfaced so UIs can show it. */
  isComplete: boolean;
}

export interface GovernedProductDataRecord {
  notionId: string;
  name: string;
  /** Notion page id of the related Official Product Catalog row, or null if unlinked. */
  productId: string | null;
  supplierId: string | null;
  module: string;
  value: string | null;
  numericValue: number | null;
  unit: string;
  dataStatus: string;
  currentEvidenceState: string;
  requiredEvidenceState: string;
  confidence: string;
  criticality: string;
  waiverClass: string;
  applicability: string;
  sourceType: string;
  sourceUrl: string | null;
  proprietary: boolean;
  founderDecisionRequired: boolean;
  lastVerified: string | null;
}

export interface GovernedSupplier {
  notionId: string;
  name: string;
  vendorType: string[];
  vendorClass: string;
  relationshipStatus: string;
  qualificationStatus: string;
  feasibilityStatus: string;
  riskLevel: string;
  confidentialityStatus: string;
  insuranceStatus: string;
  primaryContact: string | null;
  contactTitle: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  cityRegion: string | null;
  country: string | null;
  generalMoq: string | null;
  indicativeUnitCost: string | null;
  paymentTerms: string | null;
  typicalLeadTime: string | null;
  relatedProductIds: string[];
  lastVerified: string | null;
  isComplete: boolean;
}

/** Exported for direct unit testing of the Notion-row → GovernedProduct
 * mapping (missing/incomplete values, etc.) without needing a live Notion
 * fetch. Not part of the public retrieval API — prefer `getGovernedCatalog`. */
export function mapProduct(row: NRow): GovernedProduct {
  const name = titleAny(row, ["name"]).trim();
  const architectureRole = architectureRoleOf(row);
  const status = textAny(row, ["status"]);
  return {
    notionId: row.id,
    name,
    architectureRole,
    developmentGate: textAny(row, ["development gate"]),
    status,
    category: textAny(row, ["category"]),
    productOwnership: textAny(row, ["product ownership"]),
    inventoryBearing: checkboxAny(row, ["inventory bearing"]),
    founderDecisionRequired: checkboxAny(row, ["founder decision required"]),
    displayProductId: numberAny(row, ["product id"]),
    lastVerified: dateAny(row, ["last verified"]),
    useEnvironment: multiSelectAny(row, ["use environment"]),
    q3Priority: textAny(row, ["q3 priority"]),
    driveLink: urlOrNull(row, ["drive link"]),
    launchCommerceUrl: urlOrNull(row, ["launch / commerce url", "launch commerce url"]),
    canonicalFamily: textOrNull(row, ["canonical family"]),
    notes: textOrNull(row, ["notes"]),
    primarySupplierIds: relationIds(row, ["primary supplier"]),
    supplierIds: relationIds(row, ["suppliers / manufacturers", "suppliers manufacturers"]),
    productDataRecordIds: relationIds(row, ["product data records"]),
    productFamilyFormIds: relationIds(row, ["product family / form", "product family form"]),
    isComplete: Boolean(name) && architectureRole !== "Unspecified" && Boolean(status),
  };
}

function mapProductData(row: NRow): GovernedProductDataRecord {
  const productRel = relationIds(row, ["product"]);
  const supplierRel = relationIds(row, ["supplier / manufacturer", "supplier manufacturer"]);
  return {
    notionId: row.id,
    name: titleAny(row, ["name"]).trim(),
    productId: productRel[0] ?? null,
    supplierId: supplierRel[0] ?? null,
    module: textAny(row, ["module"]),
    value: textOrNull(row, ["value"]),
    numericValue: numberAny(row, ["numeric value"]),
    unit: textAny(row, ["unit"]),
    dataStatus: textAny(row, ["data status"]),
    currentEvidenceState: textAny(row, ["current evidence state"]),
    requiredEvidenceState: textAny(row, ["required evidence state"]),
    confidence: textAny(row, ["confidence"]),
    criticality: textAny(row, ["criticality"]),
    waiverClass: textAny(row, ["waiver class"]),
    applicability: textAny(row, ["applicability"]),
    sourceType: textAny(row, ["source type"]),
    sourceUrl: urlOrNull(row, ["source url"]),
    proprietary: checkboxAny(row, ["proprietary / restricted", "proprietary restricted"]),
    founderDecisionRequired: checkboxAny(row, ["founder decision required"]),
    lastVerified: dateAny(row, ["last verified"]),
  };
}

function mapSupplier(row: NRow): GovernedSupplier {
  const name = titleAny(row, ["name"]).trim();
  return {
    notionId: row.id,
    name,
    vendorType: multiSelectAny(row, ["vendor type"]),
    vendorClass: textAny(row, ["vendor class"]),
    relationshipStatus: textAny(row, ["relationship status"]),
    qualificationStatus: textAny(row, ["qualification status"]),
    feasibilityStatus: textAny(row, ["feasibility status"]),
    riskLevel: textAny(row, ["risk level"]),
    confidentialityStatus: textAny(row, ["confidentiality status"]),
    insuranceStatus: textAny(row, ["insurance status"]),
    primaryContact: textOrNull(row, ["primary contact"]),
    contactTitle: textOrNull(row, ["contact title"]),
    email: propByName(row, ["email"])?.email ?? null,
    phone: propByName(row, ["phone"])?.phone_number ?? null,
    website: urlOrNull(row, ["website"]),
    cityRegion: textOrNull(row, ["city / region", "city region"]),
    country: textOrNull(row, ["country"]),
    generalMoq: textOrNull(row, ["general moq"]),
    indicativeUnitCost: textOrNull(row, ["indicative unit cost"]),
    paymentTerms: textOrNull(row, ["payment terms"]),
    typicalLeadTime: textOrNull(row, ["typical lead time"]),
    relatedProductIds: relationIds(row, ["related products"]),
    lastVerified: dateAny(row, ["last verified"]),
    isComplete: Boolean(name),
  };
}

// ── Public retrieval API ─────────────────────────────────────────────────────

export interface GovernedCatalogError {
  source: "productCatalog" | "productData" | "suppliers";
  message: string;
}

export interface GovernedCatalog {
  products: GovernedProduct[];
  productData: GovernedProductDataRecord[];
  suppliers: GovernedSupplier[];
  /** Per-source fetch failures. A failure in one source never blocks the
   * others — each is fetched independently and reported here rather than
   * thrown, so e.g. a Suppliers-DB hiccup doesn't take down product display. */
  errors: GovernedCatalogError[];
}

/**
 * Fetch all three governed sources independently. Each query is isolated —
 * one source failing does not prevent the other two from being returned.
 */
export async function getGovernedCatalog(): Promise<GovernedCatalog> {
  const errors: GovernedCatalogError[] = [];

  const [productsResult, productDataResult, suppliersResult] = await Promise.allSettled([
    listAllRows(GOVERNED_PRODUCT_DS.productCatalog),
    listAllRows(GOVERNED_PRODUCT_DS.productData),
    listAllRows(GOVERNED_PRODUCT_DS.suppliers),
  ]);

  const products =
    productsResult.status === "fulfilled" ? productsResult.value.map(mapProduct) : [];
  if (productsResult.status === "rejected") {
    errors.push({ source: "productCatalog", message: describeError(productsResult.reason) });
  }

  const productData =
    productDataResult.status === "fulfilled" ? productDataResult.value.map(mapProductData) : [];
  if (productDataResult.status === "rejected") {
    errors.push({ source: "productData", message: describeError(productDataResult.reason) });
  }

  const suppliers =
    suppliersResult.status === "fulfilled" ? suppliersResult.value.map(mapSupplier) : [];
  if (suppliersResult.status === "rejected") {
    errors.push({ source: "suppliers", message: describeError(suppliersResult.reason) });
  }

  return { products, productData, suppliers, errors };
}

function describeError(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

// ── Joined / resolved view ───────────────────────────────────────────────────

export interface ResolvedGovernedProduct extends GovernedProduct {
  productData: GovernedProductDataRecord[];
  primarySuppliers: GovernedSupplier[];
  suppliers: GovernedSupplier[];
}

/**
 * Joins the three independently-fetched sources in memory by Notion page id
 * (relations only carry ids, not embedded records). A product whose relation
 * points at a row that failed to fetch (or was deleted/archived in Notion)
 * simply resolves to an empty array for that join — never a fabricated stand-in.
 */
export function resolveGovernedProducts(catalog: GovernedCatalog): ResolvedGovernedProduct[] {
  const dataById = new Map(catalog.productData.map((d) => [d.notionId, d]));
  const supplierById = new Map(catalog.suppliers.map((s) => [s.notionId, s]));

  return catalog.products.map((product) => ({
    ...product,
    productData: product.productDataRecordIds
      .map((id) => dataById.get(id))
      .filter((d): d is GovernedProductDataRecord => Boolean(d)),
    primarySuppliers: product.primarySupplierIds
      .map((id) => supplierById.get(id))
      .filter((s): s is GovernedSupplier => Boolean(s)),
    suppliers: product.supplierIds
      .map((id) => supplierById.get(id))
      .filter((s): s is GovernedSupplier => Boolean(s)),
  }));
}

// ── Launch-status / readiness helpers ────────────────────────────────────────
// These exist specifically so callers never invent their own "is this live?"
// logic — the directive is explicit that unsupported launch-status
// assumptions must be rejected, so there is exactly one place this is decided.

const LAUNCHED_GATES = new Set(["Launch Ready", "Active"]);

/**
 * True only when Notion explicitly records both an Active status AND a
 * Launch Ready/Active development gate. Anything else (including "Hold",
 * "Retired", or simply unset) is NOT launched — this never guesses.
 */
export function isLaunched(product: GovernedProduct): boolean {
  return product.status === "Active" && LAUNCHED_GATES.has(product.developmentGate);
}

export function isOnHold(product: GovernedProduct): boolean {
  return product.developmentGate === "Hold";
}

export function isRetired(product: GovernedProduct): boolean {
  return product.developmentGate === "Retired" || product.status === "Retired";
}

/** Sellable, inventory-bearing products — the only rows a Shopify reconciliation should ever target. */
export function isInventoryEligible(product: GovernedProduct): boolean {
  return product.architectureRole === "Sellable Product" && product.inventoryBearing;
}

export function isAppointment(product: GovernedProduct): boolean {
  return product.architectureRole === "Appointment";
}

// ── Contact Center phase-out contract ────────────────────────────────────────
//
// `src/lib/suppliers.ts`'s `directoryFor()` currently injects hardcoded
// marketing copy (`HvnProduct.pitch`, `.intent`, `.image`) straight into the
// Contact Center UI — none of it is backed by Notion or any approval
// workflow. This function is the replacement data source for that seam:
// it surfaces only Notion-governed facts, and only once they are genuinely
// approved, never a best-effort guess. `ContactCenter.tsx` still calls
// `directoryFor()` for now (Phase 1 is additive, not a swap — see PR
// description); the phase-out plan is to delete `HvnProduct`'s free-text
// marketing fields from `suppliers.ts` once every active supplier has a
// corresponding entry this function can resolve.

export interface GovernedContactCenterProduct {
  notionId: string;
  name: string;
  category: string;
  architectureRole: ArchitectureRole;
  developmentGate: string;
  guardianNotes: string | null;
  lastVerified: string;
  supplierName: string;
}

/**
 * The "approved" gate for anything shown to a rep as fact during a live
 * call: a complete record, not on hold or retired, with no founder decision
 * still pending, AND an explicit verification date on file. Missing any one
 * of these means "not ready to say out loud to a supplier," not "assume
 * it's fine" — this is the one place that rule is decided.
 */
function isApprovedForCustomerFacingUse(product: GovernedProduct): boolean {
  return (
    product.isComplete &&
    !isOnHold(product) &&
    !isRetired(product) &&
    !product.founderDecisionRequired &&
    product.lastVerified !== null
  );
}

/**
 * Resolves the governed (Notion-approved) product(s) a named supplier is
 * associated with, for Contact Center's additive "Notion-verified" panel.
 * Returns an empty array — never a fabricated entry — when the supplier
 * isn't found, has no products, or every associated product fails the
 * approval gate above.
 */
export function governedProductsForSupplier(
  catalog: GovernedCatalog,
  supplierName: string,
): GovernedContactCenterProduct[] {
  const needle = supplierName.trim().toLowerCase();
  if (!needle) return [];
  const supplier = catalog.suppliers.find((s) => s.name.trim().toLowerCase() === needle);
  if (!supplier) return [];

  const resolved = resolveGovernedProducts(catalog);
  return resolved
    .filter(
      (p) =>
        (p.primarySuppliers.some((s) => s.notionId === supplier.notionId) ||
          p.suppliers.some((s) => s.notionId === supplier.notionId)) &&
        isApprovedForCustomerFacingUse(p),
    )
    .map((p) => ({
      notionId: p.notionId,
      name: p.name,
      category: p.category,
      architectureRole: p.architectureRole,
      developmentGate: p.developmentGate,
      guardianNotes: p.notes,
      // isApprovedForCustomerFacingUse already guarantees this is non-null.
      lastVerified: p.lastVerified as string,
      supplierName: supplier.name,
    }));
}

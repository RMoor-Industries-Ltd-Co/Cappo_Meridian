// HVN supplier directory — the single source of truth for both seeding the
// Contact Center CRM and tailoring the live call script + HVN product per
// company. Derived from the HARV Supplier Engagement Playbooks (board@,
// June 15 2026). DB persists the contact fields; `playbook`, `product`, and
// `highlights` drive the UI and are looked up by company name.

export interface HvnProduct {
  /** Product we're pitching this supplier. */
  name: string;
  /** Collection / line tag (e.g. "Sanctum collection"). */
  line?: string;
  /** One-line pitch of what we want from them. */
  pitch: string;
  /** Product intention metadata (expandable later). */
  intent?: string;
  /** Product image URL/path — placeholder for now. */
  image?: string | null;
}

export interface SeedSupplier {
  name: string;
  contact_name?: string;
  role?: string;
  phone?: string;
  email?: string;
  website?: string;
  location?: string;
  category: string;
  source: string;
  /** Playbook id from callScripts.ts. */
  playbook: string;
  product: HvnProduct;
  /** Company-specific script highlights shown in the Call Flow panel. */
  highlights?: string[];
}

const SCENT_PRODUCT: HvnProduct = {
  name: "HVN Elemental · Shadow · Sanctum",
  line: "Three-format scent line",
  pitch: "Proprietary scent families across poured candle, pressed incense ember & burning oil — dark, resinous, masculine (oud, vetiver, black amber, smoked woods).",
  intent: "Formulation partner with full IP transfer to HVN on final payment.",
  image: null,
};

export const SEED_SUPPLIERS: SeedSupplier[] = [
  // ── Furniture — Trade Program ──────────────────────────────────────
  {
    name: "Four Hands",
    role: "Trade program manager",
    website: "fourhands.com/to-the-trade",
    location: "Austin, TX, USA",
    category: "Furniture",
    source: "HARV Furniture Playbook",
    playbook: "furniture-corporate",
    product: {
      name: "HVN Curated Lounge & Accent Furniture",
      line: "Home Environment",
      pitch: "Stock Four Hands lounge seating, accent tables & occasional pieces (darker finishes, raw materials) on Shopify via Spark Shipping.",
      intent: "Catalog depth + Shopify dropship automation for accent furniture.",
      image: null,
    },
    highlights: [
      "Ships Four Hands–branded (no blind dropship) — white-label is a later-stage ask, not a first call.",
      "Integrate via Spark Shipping once the trade account is approved.",
      "Anticipate 40–50% off MSRP, Net 30, no per-order MOQ.",
    ],
  },
  {
    name: "VIG Furniture",
    role: "Wholesale / dropship manager",
    email: "info@vigfurniture.com",
    website: "vigfurniture.com",
    location: "USA",
    category: "Furniture",
    source: "HARV Furniture Playbook",
    playbook: "furniture-corporate",
    product: {
      name: "HVN Leather Lounge & Dark-Wood Accents",
      line: "Home Environment",
      pitch: "Genuine-leather lounge chairs & dark-wood accent tables, blind-dropshipped under neutral packaging.",
      intent: "Primary blind-dropship furniture supplier (native HVN delivery feel).",
      image: null,
    },
    highlights: [
      "Blind dropship ✓ confirmed — get it documented in the retailer agreement.",
      "Direct API / CSV data feed for Shopify.",
      "Highest margins in category — 40–55% off MSRP.",
    ],
  },
  // ── Furniture — Boutique / Trade-Only ──────────────────────────────
  {
    name: "NOIR Trading Inc.",
    role: "Trade team",
    website: "noirfurniturela.com",
    location: "Los Angeles, CA, USA",
    category: "Furniture",
    source: "HARV Furniture Playbook",
    playbook: "furniture-boutique",
    product: {
      name: "HVN Halo / Editorial Furniture Edit",
      line: "Curated 8–15 piece edit",
      pitch: "A tight editorial edit of NOIR's hand-rubbed-black occasional chairs & sideboards, each with full provenance & materials story.",
      intent: "Halo product + brand alignment; highest relationship ceiling of any supplier.",
      image: null,
    },
    highlights: [
      "Lead with aesthetic — name designer Georg Bahler & the hand-rubbed finishes.",
      "Trade-only, NOIR-branded packaging (no blind dropship).",
      "Ask for the embargoed lookbook once you're formally registered.",
    ],
  },
  // ── Stone / Factory ────────────────────────────────────────────────
  {
    name: "Xiamen Rising Fortune Imp & Exp Co., Ltd.",
    contact_name: "Lisa",
    role: "Sales rep",
    phone: "+86-592-6039765",
    email: "info@risingfortunetrading.com",
    website: "risingfortunetrading.com",
    location: "Xiamen, China",
    category: "Stone décor",
    source: "HARV Stone Playbook",
    playbook: "stone",
    product: {
      name: "HVN Sanctum Onyx Ashtray — Custom",
      line: "Sanctum collection",
      pitch: "Custom octagonal onyx/marble ashtrays with removable brass basin & recessed HVN engraving, produced at scale.",
      intent: "Full stone suite at production scale (100–500 units per SKU).",
      image: null,
    },
    highlights: [
      "Brass insert via partner factory — they don't make metal in-house.",
      "Custom octagonal sample $150–300/pc; don't push for sample-cost credit.",
      "Get a material certificate confirming 100% natural stone. WhatsApp: +86-13806031784.",
    ],
  },
  {
    name: "Jagdamba Marble Handicrafts",
    contact_name: "Mr. Gupta",
    role: "Owner / master artisan",
    phone: "+91-07942673978",
    website: "marblehandicraftshop.com",
    location: "Agra, India",
    category: "Stone décor",
    source: "HARV Stone Playbook",
    playbook: "stone",
    product: {
      name: "HVN Sanctum Onyx Ashtray — Hand-carved",
      line: "Sanctum collection · halo tier",
      pitch: "Hand-carved green/honey onyx ashtray with fine brass-wire inlay 'HVN' — living-heritage craftsmanship.",
      intent: "Premium hand-carved halo tier — build the relationship before negotiating price.",
      image: null,
    },
    highlights: [
      "Call directly — Indian artisan workshops respond to a real phone call.",
      "Praise the inlay craftsmanship — it's positioning, not flattery.",
      "Get a one-paragraph written design-exclusivity note via WhatsApp.",
    ],
  },
  {
    name: "Stone Products Factory (via Pietra)",
    role: "Via Pietra platform",
    website: "pietrastudio.com",
    category: "Stone décor",
    source: "HARV Stone Playbook",
    playbook: "stone",
    product: {
      name: "HVN Sanctum Onyx Ashtray — Sample Run",
      line: "Sanctum collection",
      pitch: "Low-risk first sample run of octagonal marble/onyx ashtrays through Pietra's escrow-protected platform.",
      intent: "First-time import / low-risk sampling before going factory-direct.",
      image: null,
    },
    highlights: [
      "Platform escrow protects payment; all comms in English.",
      "Transparent pricing ~$5.90–$19.90/unit; sample ~$105.93 flat.",
      "Once quality is validated, transition to a direct factory relationship.",
    ],
  },
  // ── Fragrance Consultants ──────────────────────────────────────────
  {
    name: "Dr. Justin F.",
    role: "Independent fragrance consultant",
    category: "Fragrance / raw",
    source: "HARV Fragrance Playbook",
    playbook: "fragrance",
    product: SCENT_PRODUCT,
    highlights: ["Ask early about combustion chemistry for the pressed incense ember format."],
  },
  {
    name: "Sarah Horowitz-Thran",
    role: "Independent perfumer",
    category: "Fragrance / raw",
    source: "HARV Fragrance Playbook",
    playbook: "fragrance",
    product: SCENT_PRODUCT,
    highlights: ["Strong fine-fragrance background — confirm home-application / burn-performance experience."],
  },
  {
    name: "Cassandra Browning",
    role: "Independent perfumer",
    category: "Fragrance / raw",
    source: "HARV Fragrance Playbook",
    playbook: "fragrance",
    product: SCENT_PRODUCT,
  },
  {
    name: "Miriam Vareldzis",
    role: "Independent perfumer",
    category: "Fragrance / raw",
    source: "HARV Fragrance Playbook",
    playbook: "fragrance",
    product: SCENT_PRODUCT,
  },
  {
    name: "Aromatic Innovations",
    role: "Boutique fragrance studio",
    location: "New Jersey, USA",
    category: "Fragrance / raw",
    source: "HARV Fragrance Playbook",
    playbook: "fragrance",
    product: {
      ...SCENT_PRODUCT,
      intent: "Formulation partner — and a candidate to handle Sanctum Cloth textile saturation in-house.",
    },
    highlights: ["On the shortlist; may handle textile saturation in-house for the Sanctum Cloth scented inserts."],
  },
];

/** The subset of fields persisted to the suppliers table on seed. */
export function seedRow(s: SeedSupplier) {
  return {
    name: s.name,
    contact_name: s.contact_name ?? null,
    role: s.role ?? null,
    phone: s.phone ?? null,
    email: s.email ?? null,
    website: s.website ?? null,
    location: s.location ?? null,
    category: s.category,
    source: s.source,
  };
}

const norm = (n: string) => n.trim().toLowerCase();

/** Look up a seeded supplier (playbook + product + highlights) by company name. */
export function directoryFor(name?: string | null): SeedSupplier | null {
  if (!name) return null;
  return SEED_SUPPLIERS.find((s) => norm(s.name) === norm(name)) ?? null;
}

import { Pool } from "pg";
import { env } from "@/lib/env";
import { SEED_SUPPLIERS, seedRow } from "@/lib/suppliers";

/**
 * Postgres access for Cappo_Meridian.
 *
 * Uses a single pooled connection (DATABASE_URL). The schema is created lazily
 * and idempotently on first use — no separate migration runner needed in the
 * container. When DATABASE_URL is unset (local dev), everything degrades to a
 * null pool and callers fall back to non-persistent behavior.
 */

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;
let seedReady: Promise<void> | null = null;

function getPool(): Pool | null {
  if (!env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({ connectionString: env.DATABASE_URL, max: 5 });
  }
  return pool;
}

async function ensureSchema(p: Pool): Promise<void> {
  if (!schemaReady) {
    schemaReady = p
      .query(`
        CREATE TABLE IF NOT EXISTS research_projects (
          id           BIGSERIAL PRIMARY KEY,
          name         TEXT NOT NULL,
          created_by   TEXT,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS research_messages (
          id           BIGSERIAL PRIMARY KEY,
          project_id   BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
          role         TEXT NOT NULL,
          content      TEXT NOT NULL,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_research_messages_project
          ON research_messages(project_id, id);

        CREATE TABLE IF NOT EXISTS suppliers (
          id            BIGSERIAL PRIMARY KEY,
          name          TEXT NOT NULL,
          contact_name  TEXT, role TEXT, phone TEXT, email TEXT, website TEXT,
          location      TEXT, timezone TEXT, category TEXT, source TEXT,
          stage         TEXT NOT NULL DEFAULT 'new', interest TEXT,
          moq           TEXT, lead_time TEXT, price_tiers TEXT, payment_terms TEXT,
          sample_available BOOLEAN, sample_cost TEXT, private_label BOOLEAN,
          certifications TEXT, catalog_url TEXT, shipping_origin TEXT,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS call_logs (
          id            BIGSERIAL PRIMARY KEY,
          supplier_id   BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
          rep           TEXT, outcome TEXT NOT NULL, notes TEXT,
          duration_seconds INT, callback_at TIMESTAMPTZ, clickup_url TEXT,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_call_logs_supplier ON call_logs(supplier_id, id DESC);

        CREATE TABLE IF NOT EXISTS google_tokens (
          id           TEXT PRIMARY KEY,
          data         TEXT NOT NULL,
          updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS lexicon_terms (
          id            TEXT PRIMARY KEY,
          name          TEXT NOT NULL,
          category      TEXT NOT NULL,
          meaning       TEXT,
          use_case      TEXT,
          plain_meaning TEXT,
          example       TEXT,
          corpus_status TEXT,
          training_sentences TEXT,
          word_bank_distractors TEXT,
          professional_scenarios TEXT,
          reveal_guidance TEXT,
          training_difficulty REAL,
          training_audiences TEXT,
          visual_asset_status TEXT,
          visual_source TEXT,
          source_reference TEXT,
          has_visual BOOLEAN NOT NULL DEFAULT false,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        ALTER TABLE lexicon_terms ADD COLUMN IF NOT EXISTS corpus_status TEXT;
        ALTER TABLE lexicon_terms ADD COLUMN IF NOT EXISTS training_sentences TEXT;
        ALTER TABLE lexicon_terms ADD COLUMN IF NOT EXISTS word_bank_distractors TEXT;
        ALTER TABLE lexicon_terms ADD COLUMN IF NOT EXISTS professional_scenarios TEXT;
        ALTER TABLE lexicon_terms ADD COLUMN IF NOT EXISTS reveal_guidance TEXT;
        ALTER TABLE lexicon_terms ADD COLUMN IF NOT EXISTS training_difficulty REAL;
        ALTER TABLE lexicon_terms ADD COLUMN IF NOT EXISTS training_audiences TEXT;
        ALTER TABLE lexicon_terms ADD COLUMN IF NOT EXISTS visual_asset_status TEXT;
        ALTER TABLE lexicon_terms ADD COLUMN IF NOT EXISTS visual_source TEXT;
        ALTER TABLE lexicon_terms ADD COLUMN IF NOT EXISTS source_reference TEXT;
        ALTER TABLE lexicon_terms ADD COLUMN IF NOT EXISTS has_visual BOOLEAN NOT NULL DEFAULT false;
        CREATE TABLE IF NOT EXISTS lexicon_sync_runs (
          id            BIGSERIAL PRIMARY KEY,
          ran_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
          added_count   INT NOT NULL DEFAULT 0,
          updated_count INT NOT NULL DEFAULT 0,
          total_count   INT NOT NULL DEFAULT 0,
          error         TEXT
        );

        CREATE TABLE IF NOT EXISTS cappo_reports (
          id            BIGSERIAL PRIMARY KEY,
          report_text   TEXT,
          generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          error         TEXT
        );

        -- ── CAPPO Milestone 5: governed product data + Shopify reconciliation ──
        -- Rollback (no down-migration framework exists in this repo — this is
        -- the documented manual rollback, children before parents):
        --   DROP TABLE IF EXISTS product_sync_audit_log;
        --   DROP TABLE IF EXISTS product_sync_reconciliation_failures;
        --   DROP TABLE IF EXISTS inventory_snapshots;
        --   DROP TABLE IF EXISTS product_sync_mappings;
        --   DROP TABLE IF EXISTS product_sync_runs;

        -- One row per reconciled identity: a Notion Official Product Catalog
        -- page id matched to a Shopify variant. shopify_variant_id is UNIQUE so
        -- a given Shopify variant can never be attached to two Notion products
        -- at once, and upserts are keyed on it — re-running the sync with the
        -- same match is a no-op update, never a duplicate row.
        CREATE TABLE IF NOT EXISTS product_sync_mappings (
          id                  BIGSERIAL PRIMARY KEY,
          notion_product_id   TEXT NOT NULL,
          shopify_product_id  TEXT,
          shopify_variant_id  TEXT NOT NULL,
          sku                 TEXT,
          match_method        TEXT NOT NULL DEFAULT 'sku_exact',
          matched_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
          created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (shopify_variant_id)
        );
        CREATE INDEX IF NOT EXISTS idx_product_sync_mappings_notion
          ON product_sync_mappings(notion_product_id);

        -- Append-only point-in-time inventory readings. "available" is
        -- nullable and MUST stay that way: Shopify not reporting a quantity
        -- for an item/location means "unknown," never "0 in stock" — a sync
        -- that coerced null to 0 would misreport real stock as sold out.
        CREATE TABLE IF NOT EXISTS inventory_snapshots (
          id                        BIGSERIAL PRIMARY KEY,
          shopify_variant_id        TEXT NOT NULL,
          shopify_inventory_item_id TEXT,
          location_id               TEXT,
          available                 INT,
          captured_at               TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_variant_time
          ON inventory_snapshots(shopify_variant_id, captured_at DESC);

        -- One row per sync run (mirrors lexicon_sync_runs's existing pattern).
        CREATE TABLE IF NOT EXISTS product_sync_runs (
          id                      BIGSERIAL PRIMARY KEY,
          ran_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
          status                  TEXT NOT NULL DEFAULT 'success',
          products_seen           INT NOT NULL DEFAULT 0,
          mapped_count            INT NOT NULL DEFAULT 0,
          unmapped_count          INT NOT NULL DEFAULT 0,
          reconciliation_failures INT NOT NULL DEFAULT 0,
          error                   TEXT
        );

        -- Specific reconciliation problems from a given run (ambiguous SKU
        -- match, Shopify fetch error for one product, etc.) — kept distinct
        -- from the run's own summary counts so each failure is inspectable.
        CREATE TABLE IF NOT EXISTS product_sync_reconciliation_failures (
          id              BIGSERIAL PRIMARY KEY,
          sync_run_id     BIGINT REFERENCES product_sync_runs(id) ON DELETE CASCADE,
          subject_type    TEXT NOT NULL,
          subject_id      TEXT NOT NULL,
          reason          TEXT NOT NULL,
          detail          TEXT,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_product_sync_failures_run
          ON product_sync_reconciliation_failures(sync_run_id);

        -- Durable audit trail of every mapping/snapshot write a sync run makes.
        CREATE TABLE IF NOT EXISTS product_sync_audit_log (
          id                  BIGSERIAL PRIMARY KEY,
          sync_run_id         BIGINT REFERENCES product_sync_runs(id) ON DELETE SET NULL,
          action              TEXT NOT NULL,
          notion_product_id   TEXT,
          shopify_variant_id  TEXT,
          detail              TEXT,
          created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_product_sync_audit_run
          ON product_sync_audit_log(sync_run_id);
      `)
      .then(() => undefined)
      .catch((e) => {
        schemaReady = null; // allow retry on next call
        throw e;
      });
  }
  return schemaReady;
}

/**
 * Seed the HVN supplier directory once per process. Idempotent: inserts each
 * supplier only if a row with that name doesn't already exist, so it never
 * duplicates or clobbers rows the user has edited.
 */
async function ensureSeed(p: Pool): Promise<void> {
  if (!seedReady) {
    seedReady = (async () => {
      for (const s of SEED_SUPPLIERS) {
        const r = seedRow(s);
        await p.query(
          `INSERT INTO suppliers (name, contact_name, role, phone, email, website, location, category, source)
             SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9
             WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE name = $1)`,
          [r.name, r.contact_name, r.role, r.phone, r.email, r.website, r.location, r.category, r.source],
        );
      }
    })().catch((e) => {
      seedReady = null; // allow retry on next call
      throw e;
    });
  }
  return seedReady;
}

/** Returns a ready pool (schema ensured + suppliers seeded), or null if DB isn't configured. */
export async function db(): Promise<Pool | null> {
  const p = getPool();
  if (!p) return null;
  await ensureSchema(p);
  await ensureSeed(p);
  return p;
}

// ── Types ────────────────────────────────────────────────────────────
export interface ResearchProject {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
export interface ResearchMessage {
  id: string;
  project_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

// ── Queries ──────────────────────────────────────────────────────────
export async function listProjects(): Promise<ResearchProject[]> {
  const p = await db();
  if (!p) return [];
  const { rows } = await p.query<ResearchProject>(
    `SELECT id::text, name, created_by, created_at, updated_at
       FROM research_projects ORDER BY updated_at DESC LIMIT 200`,
  );
  return rows;
}

export async function createProject(name: string, createdBy: string | null): Promise<ResearchProject> {
  const p = await db();
  if (!p) throw new Error("Database not configured");
  const { rows } = await p.query<ResearchProject>(
    `INSERT INTO research_projects (name, created_by)
       VALUES ($1, $2)
       RETURNING id::text, name, created_by, created_at, updated_at`,
    [name, createdBy],
  );
  return rows[0];
}

export async function deleteProject(id: string): Promise<void> {
  const p = await db();
  if (!p) return;
  await p.query(`DELETE FROM research_projects WHERE id = $1`, [id]);
}

export async function renameProject(id: string, name: string): Promise<ResearchProject | null> {
  const p = await db();
  if (!p) return null;
  const { rows } = await p.query<ResearchProject>(
    `UPDATE research_projects SET name = $1, updated_at = now()
       WHERE id = $2
       RETURNING id::text, name, created_by, created_at, updated_at`,
    [name, id],
  );
  return rows[0] ?? null;
}

export async function listMessages(projectId: string): Promise<ResearchMessage[]> {
  const p = await db();
  if (!p) return [];
  const { rows } = await p.query<ResearchMessage>(
    `SELECT id::text, project_id::text, role, content, created_at
       FROM research_messages WHERE project_id = $1 ORDER BY id ASC`,
    [projectId],
  );
  return rows;
}

export async function addMessage(
  projectId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  const p = await db();
  if (!p) return;
  await p.query(
    `INSERT INTO research_messages (project_id, role, content) VALUES ($1, $2, $3)`,
    [projectId, role, content],
  );
  await p.query(`UPDATE research_projects SET updated_at = now() WHERE id = $1`, [projectId]);
}

// ── Contact Center (supplier CRM + call logs) ────────────────────────
export interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  location: string | null;
  timezone: string | null;
  category: string | null;
  source: string | null;
  stage: string;
  interest: string | null;
  moq: string | null;
  lead_time: string | null;
  price_tiers: string | null;
  payment_terms: string | null;
  sample_available: boolean | null;
  sample_cost: string | null;
  private_label: boolean | null;
  certifications: string | null;
  catalog_url: string | null;
  shipping_origin: string | null;
  created_at: string;
  updated_at: string;
}
export interface CallLog {
  id: string;
  supplier_id: string;
  rep: string | null;
  outcome: string;
  notes: string | null;
  duration_seconds: number | null;
  callback_at: string | null;
  clickup_url: string | null;
  created_at: string;
}

const SUP_COLS = [
  "name", "contact_name", "role", "phone", "email", "website", "location", "timezone",
  "category", "source", "stage", "interest", "moq", "lead_time", "price_tiers",
  "payment_terms", "sample_available", "sample_cost", "private_label", "certifications",
  "catalog_url", "shipping_origin",
] as const;
const SUP_RET = `id::text, ${SUP_COLS.join(", ")}, created_at, updated_at`;
const CALL_RET =
  "id::text, supplier_id::text, rep, outcome, notes, duration_seconds, callback_at, clickup_url, created_at";

export async function listSuppliers(): Promise<Supplier[]> {
  const p = await db();
  if (!p) return [];
  const { rows } = await p.query<Supplier>(`SELECT ${SUP_RET} FROM suppliers ORDER BY updated_at DESC LIMIT 500`);
  return rows;
}

export async function getSupplierWithCalls(
  id: string,
): Promise<{ supplier: Supplier | null; calls: CallLog[] }> {
  const p = await db();
  if (!p) return { supplier: null, calls: [] };
  const s = await p.query<Supplier>(`SELECT ${SUP_RET} FROM suppliers WHERE id = $1`, [id]);
  const c = await p.query<CallLog>(
    `SELECT ${CALL_RET} FROM call_logs WHERE supplier_id = $1 ORDER BY id DESC LIMIT 50`,
    [id],
  );
  return { supplier: s.rows[0] ?? null, calls: c.rows };
}

/** Insert or update a supplier (by presence of id). Returns the full row. */
export async function upsertSupplier(s: Record<string, unknown>): Promise<Supplier> {
  const p = await db();
  if (!p) throw new Error("Database not configured");
  const vals = SUP_COLS.map((c) => s[c] ?? null);
  if (s.id) {
    const sets = SUP_COLS.map((c, i) => `${c} = $${i + 1}`).join(", ");
    const { rows } = await p.query<Supplier>(
      `UPDATE suppliers SET ${sets}, updated_at = now() WHERE id = $${SUP_COLS.length + 1} RETURNING ${SUP_RET}`,
      [...vals, s.id],
    );
    return rows[0];
  }
  const ph = SUP_COLS.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await p.query<Supplier>(
    `INSERT INTO suppliers (${SUP_COLS.join(", ")}) VALUES (${ph}) RETURNING ${SUP_RET}`,
    vals,
  );
  return rows[0];
}

export async function logCall(
  supplierId: string,
  c: { rep?: string | null; outcome: string; notes?: string | null; durationSeconds?: number | null; callbackAt?: string | null },
): Promise<CallLog> {
  const p = await db();
  if (!p) throw new Error("Database not configured");
  const { rows } = await p.query<CallLog>(
    `INSERT INTO call_logs (supplier_id, rep, outcome, notes, duration_seconds, callback_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${CALL_RET}`,
    [supplierId, c.rep ?? null, c.outcome, c.notes ?? null, c.durationSeconds ?? null, c.callbackAt ?? null],
  );
  return rows[0];
}

export async function setCallClickup(callId: string, url: string): Promise<void> {
  const p = await db();
  if (!p) return;
  await p.query(`UPDATE call_logs SET clickup_url = $1 WHERE id = $2`, [url, callId]);
}

// ── Google OAuth tokens ──────────────────────────────────────────────
// Opaque blob storage; callers encrypt/decrypt the payload (see crypto.ts).
export async function saveGoogleToken(id: string, data: string): Promise<void> {
  const p = await db();
  if (!p) throw new Error("Database not configured");
  await p.query(
    `INSERT INTO google_tokens (id, data, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [id, data],
  );
}

export async function loadGoogleToken(id: string): Promise<string | null> {
  const p = await db();
  if (!p) return null;
  const { rows } = await p.query<{ data: string }>(
    `SELECT data FROM google_tokens WHERE id = $1`,
    [id],
  );
  return rows[0]?.data ?? null;
}

// ── Lexicon (Notion-synced) ──────────────────────────────────────────
export interface StoredLexiconTerm {
  id: string;
  name: string;
  category: string;
  meaning: string | null;
  use_case: string | null;
  plain_meaning: string | null;
  example: string | null;
  corpus_status: string | null;
  training_sentences: string | null;
  word_bank_distractors: string | null;
  professional_scenarios: string | null;
  reveal_guidance: string | null;
  training_difficulty: number | null;
  training_audiences: string | null;
  visual_asset_status: string | null;
  visual_source: string | null;
  source_reference: string | null;
  has_visual: boolean;
}

export async function listLexiconTerms(): Promise<StoredLexiconTerm[]> {
  const p = await db();
  if (!p) return [];
  const { rows } = await p.query<StoredLexiconTerm>(
    `SELECT id, name, category, meaning, use_case, plain_meaning, example,
            corpus_status, training_sentences, word_bank_distractors, professional_scenarios,
            reveal_guidance, training_difficulty, training_audiences, visual_asset_status,
            visual_source, source_reference, has_visual
       FROM lexicon_terms ORDER BY name ASC`,
  );
  return rows;
}

interface UpsertLexiconTermInput {
  id: string;
  name: string;
  category: string;
  meaning: string;
  use: string;
  plainMeaning: string;
  example: string;
  corpusStatus: string;
  trainingSentences: string;
  wordBankDistractors: string;
  professionalScenarios: string;
  revealGuidance: string;
  trainingDifficulty: number | null;
  trainingAudiences: string;
  visualAssetStatus: string;
  visualSource: string;
  sourceReference: string;
  hasVisual: boolean;
}

/** Upsert each term by its Notion block id. Returns how many were newly inserted vs updated. */
export async function upsertLexiconTerms(
  terms: UpsertLexiconTermInput[],
): Promise<{ added: number; updated: number }> {
  const p = await db();
  if (!p) throw new Error("Database not configured");
  let added = 0;
  let updated = 0;
  for (const t of terms) {
    const { rows } = await p.query<{ inserted: boolean }>(
      `INSERT INTO lexicon_terms (
         id, name, category, meaning, use_case, plain_meaning, example, corpus_status,
         training_sentences, word_bank_distractors, professional_scenarios, reveal_guidance,
         training_difficulty, training_audiences, visual_asset_status, visual_source,
         source_reference, has_visual, updated_at
       )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, now())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, category = EXCLUDED.category, meaning = EXCLUDED.meaning,
         use_case = EXCLUDED.use_case, plain_meaning = EXCLUDED.plain_meaning, example = EXCLUDED.example,
         corpus_status = EXCLUDED.corpus_status, training_sentences = EXCLUDED.training_sentences,
         word_bank_distractors = EXCLUDED.word_bank_distractors,
         professional_scenarios = EXCLUDED.professional_scenarios,
         reveal_guidance = EXCLUDED.reveal_guidance, training_difficulty = EXCLUDED.training_difficulty,
         training_audiences = EXCLUDED.training_audiences,
         visual_asset_status = EXCLUDED.visual_asset_status, visual_source = EXCLUDED.visual_source,
         source_reference = EXCLUDED.source_reference, has_visual = EXCLUDED.has_visual,
         updated_at = now()
       RETURNING (xmax = 0) AS inserted`,
      [
        t.id,
        t.name,
        t.category,
        t.meaning,
        t.use,
        t.plainMeaning,
        t.example,
        t.corpusStatus,
        t.trainingSentences,
        t.wordBankDistractors,
        t.professionalScenarios,
        t.revealGuidance,
        t.trainingDifficulty,
        t.trainingAudiences,
        t.visualAssetStatus,
        t.visualSource,
        t.sourceReference,
        t.hasVisual,
      ],
    );
    if (rows[0]?.inserted) added += 1;
    else updated += 1;
  }
  return { added, updated };
}

/**
 * Make the stored lexicon mirror the Official Database: delete every row whose Notion id is not
 * in the current active set (retired, superseded, split or renamed-away entries). The Text
 * Reference is the source of truth, so the copy must not retain terms it no longer lists.
 *
 * Guarded against a bad read: an empty active set is a no-op, and a prune that would remove more
 * than a quarter of the stored rows is refused rather than run. Returns how many were removed.
 */
export async function pruneRemovedLexiconTerms(activeIds: string[]): Promise<number> {
  if (activeIds.length === 0) return 0;
  const p = await db();
  if (!p) throw new Error("Database not configured");
  const { rows } = await p.query<{ total: string; stale: string }>(
    `SELECT count(*)::text AS total,
            count(*) FILTER (WHERE NOT (id = ANY($1::text[])))::text AS stale
       FROM lexicon_terms`,
    [activeIds],
  );
  const total = Number(rows[0]?.total ?? 0);
  const stale = Number(rows[0]?.stale ?? 0);
  if (stale === 0) return 0;
  if (stale > Math.max(1, Math.floor(total / 4))) {
    throw new Error(`Refusing to prune ${stale} of ${total} lexicon rows — Notion read looks incomplete`);
  }
  const { rowCount } = await p.query(`DELETE FROM lexicon_terms WHERE NOT (id = ANY($1::text[]))`, [activeIds]);
  return rowCount ?? 0;
}

export async function logLexiconSync(result: {
  added: number;
  updated: number;
  total: number;
  error?: string;
}): Promise<void> {
  const p = await db();
  if (!p) return;
  await p.query(
    `INSERT INTO lexicon_sync_runs (added_count, updated_count, total_count, error) VALUES ($1, $2, $3, $4)`,
    [result.added, result.updated, result.total, result.error ?? null],
  );
}

export async function getLastLexiconSync(): Promise<{ ran_at: string; error: string | null } | null> {
  const p = await db();
  if (!p) return null;
  const { rows } = await p.query<{ ran_at: string; error: string | null }>(
    `SELECT ran_at::text, error FROM lexicon_sync_runs ORDER BY id DESC LIMIT 1`,
  );
  return rows[0] ?? null;
}

// ── Cappo executive reports (cappoReportScheduler.ts) ────────────────
// Same shape as lexicon_sync_runs: append-only run log, latest row = current report.
export async function saveCappoReport(reportText: string | null, error?: string): Promise<void> {
  const p = await db();
  if (!p) return;
  await p.query(
    `INSERT INTO cappo_reports (report_text, error) VALUES ($1, $2)`,
    [reportText, error ?? null],
  );
}

export async function getLastCappoReport(): Promise<
  { report_text: string | null; generated_at: string; error: string | null } | null
> {
  const p = await db();
  if (!p) return null;
  const { rows } = await p.query<{ report_text: string | null; generated_at: string; error: string | null }>(
    `SELECT report_text, generated_at::text, error FROM cappo_reports ORDER BY id DESC LIMIT 1`,
  );
  return rows[0] ?? null;
}

/** Distinct from getLastCappoReport(), which the scheduler uses to gate regeneration off the
 * newest row (success or failure). This is for the pull endpoint: a transient outage after the
 * scheduler's cache table already holds a good report shouldn't make ALLIE see a null report --
 * she should keep getting the last one that actually generated until a new one succeeds. */
export async function getLastSuccessfulCappoReport(): Promise<
  { report_text: string | null; generated_at: string; error: string | null } | null
> {
  const p = await db();
  if (!p) return null;
  const { rows } = await p.query<{ report_text: string | null; generated_at: string; error: string | null }>(
    `SELECT report_text, generated_at::text, error FROM cappo_reports WHERE report_text IS NOT NULL ORDER BY id DESC LIMIT 1`,
  );
  return rows[0] ?? null;
}

// ── CAPPO Milestone 5: product sync (Notion ↔ Shopify) ───────────────────────
// See src/lib/productSync.ts for the reconciliation logic that calls these.

export interface ProductSyncMapping {
  id: string;
  notion_product_id: string;
  shopify_product_id: string | null;
  shopify_variant_id: string;
  sku: string | null;
  match_method: string;
  matched_at: string;
  updated_at: string;
}

/** Idempotent: re-running with the same shopify_variant_id updates the
 * existing row (keyed on the UNIQUE constraint) rather than duplicating it. */
export async function upsertProductSyncMapping(m: {
  notionProductId: string;
  shopifyProductId: string | null;
  shopifyVariantId: string;
  sku: string | null;
  matchMethod: string;
}): Promise<ProductSyncMapping> {
  const p = await db();
  if (!p) throw new Error("Database not configured");
  const { rows } = await p.query<ProductSyncMapping>(
    `INSERT INTO product_sync_mappings
       (notion_product_id, shopify_product_id, shopify_variant_id, sku, match_method)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (shopify_variant_id) DO UPDATE SET
         notion_product_id  = EXCLUDED.notion_product_id,
         shopify_product_id = EXCLUDED.shopify_product_id,
         sku                = EXCLUDED.sku,
         match_method       = EXCLUDED.match_method,
         matched_at         = now(),
         updated_at         = now()
       RETURNING id::text, notion_product_id, shopify_product_id, shopify_variant_id, sku,
                 match_method, matched_at::text, updated_at::text`,
    [m.notionProductId, m.shopifyProductId, m.shopifyVariantId, m.sku, m.matchMethod],
  );
  return rows[0];
}

export async function listProductSyncMappings(): Promise<ProductSyncMapping[]> {
  const p = await db();
  if (!p) return [];
  const { rows } = await p.query<ProductSyncMapping>(
    `SELECT id::text, notion_product_id, shopify_product_id, shopify_variant_id, sku,
            match_method, matched_at::text, updated_at::text
       FROM product_sync_mappings ORDER BY updated_at DESC`,
  );
  return rows;
}

/** Records one point-in-time inventory reading. `available: null` is a valid,
 * meaningful input — it must never be rewritten to 0 before calling this. */
export async function recordInventorySnapshot(s: {
  shopifyVariantId: string;
  shopifyInventoryItemId: string | null;
  locationId: string | null;
  available: number | null;
}): Promise<void> {
  const p = await db();
  if (!p) return;
  await p.query(
    `INSERT INTO inventory_snapshots
       (shopify_variant_id, shopify_inventory_item_id, location_id, available)
       VALUES ($1, $2, $3, $4)`,
    [s.shopifyVariantId, s.shopifyInventoryItemId, s.locationId, s.available],
  );
}

export interface LatestInventorySnapshot {
  shopify_variant_id: string;
  location_id: string | null;
  available: number | null;
  captured_at: string;
}

/** Most recent snapshot per (variant, location) — DISTINCT ON keeps this a
 * single indexed scan rather than a correlated subquery per variant. */
export async function listLatestInventorySnapshots(): Promise<LatestInventorySnapshot[]> {
  const p = await db();
  if (!p) return [];
  const { rows } = await p.query<LatestInventorySnapshot>(
    `SELECT DISTINCT ON (shopify_variant_id, location_id)
            shopify_variant_id, location_id, available, captured_at::text
       FROM inventory_snapshots
      ORDER BY shopify_variant_id, location_id, captured_at DESC`,
  );
  return rows;
}

export interface ProductSyncRun {
  id: string;
  ran_at: string;
  status: string;
  products_seen: number;
  mapped_count: number;
  unmapped_count: number;
  reconciliation_failures: number;
  error: string | null;
}

export async function createProductSyncRun(r: {
  status: string;
  productsSeen: number;
  mappedCount: number;
  unmappedCount: number;
  reconciliationFailures: number;
  error: string | null;
}): Promise<ProductSyncRun> {
  const p = await db();
  if (!p) throw new Error("Database not configured");
  const { rows } = await p.query<ProductSyncRun>(
    `INSERT INTO product_sync_runs
       (status, products_seen, mapped_count, unmapped_count, reconciliation_failures, error)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id::text, ran_at::text, status, products_seen, mapped_count, unmapped_count,
                 reconciliation_failures, error`,
    [r.status, r.productsSeen, r.mappedCount, r.unmappedCount, r.reconciliationFailures, r.error],
  );
  return rows[0];
}

export async function getLastProductSyncRun(): Promise<ProductSyncRun | null> {
  const p = await db();
  if (!p) return null;
  const { rows } = await p.query<ProductSyncRun>(
    `SELECT id::text, ran_at::text, status, products_seen, mapped_count, unmapped_count,
            reconciliation_failures, error
       FROM product_sync_runs ORDER BY id DESC LIMIT 1`,
  );
  return rows[0] ?? null;
}

export async function recordProductSyncFailure(f: {
  syncRunId: string;
  subjectType: string;
  subjectId: string;
  reason: string;
  detail: string | null;
}): Promise<void> {
  const p = await db();
  if (!p) return;
  await p.query(
    `INSERT INTO product_sync_reconciliation_failures
       (sync_run_id, subject_type, subject_id, reason, detail)
       VALUES ($1, $2, $3, $4, $5)`,
    [f.syncRunId, f.subjectType, f.subjectId, f.reason, f.detail],
  );
}

export interface ProductSyncFailure {
  id: string;
  subject_type: string;
  subject_id: string;
  reason: string;
  detail: string | null;
  created_at: string;
}

export async function listProductSyncFailures(syncRunId?: string): Promise<ProductSyncFailure[]> {
  const p = await db();
  if (!p) return [];
  const { rows } = await p.query<ProductSyncFailure>(
    syncRunId
      ? `SELECT id::text, subject_type, subject_id, reason, detail, created_at::text
           FROM product_sync_reconciliation_failures WHERE sync_run_id = $1 ORDER BY id DESC`
      : `SELECT id::text, subject_type, subject_id, reason, detail, created_at::text
           FROM product_sync_reconciliation_failures ORDER BY id DESC LIMIT 100`,
    syncRunId ? [syncRunId] : [],
  );
  return rows;
}

export async function recordProductSyncAudit(a: {
  syncRunId: string | null;
  action: string;
  notionProductId: string | null;
  shopifyVariantId: string | null;
  detail: string | null;
}): Promise<void> {
  const p = await db();
  if (!p) return;
  await p.query(
    `INSERT INTO product_sync_audit_log
       (sync_run_id, action, notion_product_id, shopify_variant_id, detail)
       VALUES ($1, $2, $3, $4, $5)`,
    [a.syncRunId, a.action, a.notionProductId, a.shopifyVariantId, a.detail],
  );
}

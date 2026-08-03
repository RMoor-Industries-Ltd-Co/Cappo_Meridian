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

        -- Google OAuth credentials, keyed by account. Lives in Postgres rather
        -- than a file so tokens survive a container redeploy, and so more than
        -- one Workspace account can be connected at once.
        CREATE TABLE IF NOT EXISTS google_tokens (
          account       TEXT PRIMARY KEY,
          data          TEXT NOT NULL,
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        -- ── Meeting intelligence ──────────────────────────────────────
        CREATE TABLE IF NOT EXISTS meetings (
          id            BIGSERIAL PRIMARY KEY,
          title         TEXT NOT NULL,
          occurred_at   TIMESTAMPTZ NOT NULL,
          dedup_key     TEXT NOT NULL UNIQUE,
          participants  TEXT[],
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS meeting_transcripts (
          id            BIGSERIAL PRIMARY KEY,
          meeting_id    BIGINT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
          source        TEXT NOT NULL,
          source_ref    TEXT NOT NULL,
          rank          INT NOT NULL DEFAULT 9,
          body          TEXT NOT NULL,
          brief         TEXT,
          analyzed_at   TIMESTAMPTZ,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (source, source_ref)
        );
        CREATE TABLE IF NOT EXISTS initiatives (
          id            BIGSERIAL PRIMARY KEY,
          title         TEXT NOT NULL,
          slug          TEXT NOT NULL UNIQUE,
          summary       TEXT NOT NULL,
          horizon       TEXT NOT NULL DEFAULT 'current',
          status        TEXT NOT NULL DEFAULT 'active',
          owner         TEXT,
          first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          clickup_url   TEXT,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS initiative_mentions (
          id            BIGSERIAL PRIMARY KEY,
          initiative_id BIGINT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
          meeting_id    BIGINT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
          excerpt       TEXT NOT NULL,
          change_note   TEXT,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (initiative_id, meeting_id)
        );
        CREATE TABLE IF NOT EXISTS period_rollups (
          id            BIGSERIAL PRIMARY KEY,
          period_kind   TEXT NOT NULL,
          period_start  DATE NOT NULL,
          narrative     TEXT NOT NULL,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (period_kind, period_start)
        );
        CREATE TABLE IF NOT EXISTS digests (
          id            BIGSERIAL PRIMARY KEY,
          sent_for      DATE NOT NULL UNIQUE,
          subject       TEXT NOT NULL,
          body_html     TEXT NOT NULL,
          body_text     TEXT NOT NULL,
          recipients    TEXT NOT NULL,
          gmail_msg_id  TEXT,
          sent_at       TIMESTAMPTZ,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        -- The archive moved transcript BODIES to Drive; these columns keep the
        -- small structured facts Postgres still needs (the initiative registry
        -- foreign-keys to meetings, and analysis needs to know which archived
        -- file to read and whether it has been processed). Added via ALTER
        -- because CREATE TABLE IF NOT EXISTS won't touch an existing table.
        ALTER TABLE meetings ADD COLUMN IF NOT EXISTS archive_key     TEXT;
        ALTER TABLE meetings ADD COLUMN IF NOT EXISTS category        TEXT;
        ALTER TABLE meetings ADD COLUMN IF NOT EXISTS analyzed_source TEXT;
        ALTER TABLE meetings ADD COLUMN IF NOT EXISTS brief           TEXT;
        ALTER TABLE meetings ADD COLUMN IF NOT EXISTS analyzed_at     TIMESTAMPTZ;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_meetings_archive_key
          ON meetings(archive_key) WHERE archive_key IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_meetings_unanalyzed
          ON meetings(occurred_at) WHERE analyzed_at IS NULL AND archive_key IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_transcripts_meeting ON meeting_transcripts(meeting_id, rank);
        CREATE INDEX IF NOT EXISTS idx_transcripts_pending ON meeting_transcripts(analyzed_at) WHERE analyzed_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_mentions_initiative ON initiative_mentions(initiative_id, id DESC);
        CREATE INDEX IF NOT EXISTS idx_initiatives_open ON initiatives(status, horizon, last_seen_at DESC);
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

// ── Meeting intelligence ─────────────────────────────────────────────
export type MeetingSource = "gemini" | "fathom" | "notion" | "clickup";
export type Horizon = "current" | "future";
export type InitiativeStatus = "active" | "completed" | "dropped";

export interface Meeting {
  id: string;
  title: string;
  occurred_at: string;
  dedup_key: string;
  participants: string[] | null;
  created_at: string;
}
export interface MeetingTranscript {
  id: string;
  meeting_id: string;
  source: MeetingSource;
  source_ref: string;
  rank: number;
  body: string;
  brief: string | null;
  analyzed_at: string | null;
  created_at: string;
}
export interface Initiative {
  id: string;
  title: string;
  slug: string;
  summary: string;
  horizon: Horizon;
  status: InitiativeStatus;
  owner: string | null;
  first_seen_at: string;
  last_seen_at: string;
  clickup_url: string | null;
}
export interface InitiativeMention {
  id: string;
  initiative_id: string;
  meeting_id: string;
  excerpt: string;
  change_note: string | null;
  created_at: string;
  meeting_title?: string;
  occurred_at?: string;
}
export interface Digest {
  id: string;
  sent_for: string;
  subject: string;
  body_html: string;
  body_text: string;
  recipients: string;
  gmail_msg_id: string | null;
  sent_at: string | null;
  created_at: string;
}

// node-postgres hydrates timestamptz into a JS Date. Everything downstream —
// prompt context, digest rendering, sorting — treats these as ISO strings, so
// cast in SQL rather than declaring `string` and shipping a Date.
const INIT_RET =
  "id::text, title, slug, summary, horizon, status, owner, " +
  "first_seen_at::text, last_seen_at::text, clickup_url";

/** Upsert the meeting for a dedup key. Returns its id. Idempotent across sources. */
export async function upsertMeeting(m: {
  title: string;
  occurredAt: string;
  dedupKey: string;
  participants?: string[];
}): Promise<string | null> {
  const p = await db();
  if (!p) return null;
  const { rows } = await p.query<{ id: string }>(
    `INSERT INTO meetings (title, occurred_at, dedup_key, participants)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (dedup_key) DO UPDATE SET title = EXCLUDED.title
       RETURNING id::text`,
    [m.title, m.occurredAt, m.dedupKey, m.participants ?? null],
  );
  return rows[0]?.id ?? null;
}

/**
 * Store one source's transcript for a meeting. Returns true when a new row was
 * written, false when this (source, source_ref) was already ingested — which is
 * what makes re-running the sync job safe.
 */
export async function insertTranscript(t: {
  meetingId: string;
  source: MeetingSource;
  sourceRef: string;
  rank: number;
  body: string;
}): Promise<boolean> {
  const p = await db();
  if (!p) return false;
  const { rowCount } = await p.query(
    `INSERT INTO meeting_transcripts (meeting_id, source, source_ref, rank, body)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (source, source_ref) DO NOTHING`,
    [t.meetingId, t.source, t.sourceRef, t.rank, t.body],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Transcripts awaiting analysis — at most one per meeting, always the
 * best-ranked source. Analyzing a second source for the same meeting would
 * double-count every initiative discussed in it.
 */
export async function pendingTranscripts(limit = 10): Promise<(MeetingTranscript & { title: string; occurred_at: string })[]> {
  const p = await db();
  if (!p) return [];
  // DISTINCT ON must order by meeting_id first, so chronological ordering —
  // which matters, the registry has to evolve in the order meetings happened —
  // is applied by the outer query over the real timestamp, not its text cast.
  const { rows } = await p.query(
    `SELECT s.id, s.meeting_id, s.source, s.source_ref, s.rank, s.body,
            s.brief, s.analyzed_at, s.created_at, s.title, s.ts::text AS occurred_at
       FROM (
         SELECT DISTINCT ON (t.meeting_id)
                t.id::text, t.meeting_id::text, t.source, t.source_ref, t.rank,
                t.body, t.brief, t.analyzed_at::text, t.created_at::text,
                m.title, m.occurred_at AS ts
           FROM meeting_transcripts t
           JOIN meetings m ON m.id = t.meeting_id
          WHERE t.analyzed_at IS NULL
          ORDER BY t.meeting_id, t.rank ASC
       ) s
      ORDER BY s.ts ASC
      LIMIT $1`,
    [limit],
  );
  return rows;
}

// ── Archive-backed meetings ──────────────────────────────────────────
// The Drive archive is the system of record. These rows are a rebuildable
// cache: enough structure for the initiative registry to reference a meeting
// and for analysis to find its transcript, with no transcript text stored.

export interface ArchivedMeeting {
  id: string;
  archive_key: string;
  title: string;
  occurred_at: string;
  category: string | null;
  analyzed_source: string | null;
}

/** Mirror one archived meeting into Postgres. Idempotent on dedup_key. */
export async function upsertArchivedMeeting(m: {
  archiveKey: string;
  title: string;
  occurredAt: string;
  dedupKey: string;
  participants?: string[];
  category?: string;
  analyzedSource?: string;
}): Promise<string | null> {
  const p = await db();
  if (!p) return null;
  const { rows } = await p.query<{ id: string }>(
    `INSERT INTO meetings (title, occurred_at, dedup_key, participants,
                           archive_key, category, analyzed_source)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (dedup_key) DO UPDATE SET
       title           = EXCLUDED.title,
       occurred_at     = EXCLUDED.occurred_at,
       participants    = EXCLUDED.participants,
       archive_key     = EXCLUDED.archive_key,
       category        = EXCLUDED.category,
       analyzed_source = EXCLUDED.analyzed_source
     RETURNING id::text`,
    [
      m.title,
      m.occurredAt,
      m.dedupKey,
      m.participants ?? null,
      m.archiveKey,
      m.category ?? null,
      m.analyzedSource ?? null,
    ],
  );
  return rows[0]?.id ?? null;
}

/**
 * Archived meetings awaiting analysis, oldest first — the registry has to
 * evolve in the order meetings actually happened, or a later meeting's context
 * would be applied before the earlier one that established it.
 */
export async function pendingArchivedMeetings(limit = 10): Promise<ArchivedMeeting[]> {
  const p = await db();
  if (!p) return [];
  const { rows } = await p.query<ArchivedMeeting>(
    `SELECT id::text, archive_key, title, occurred_at::text, category, analyzed_source
       FROM meetings
      WHERE analyzed_at IS NULL AND archive_key IS NOT NULL
      ORDER BY occurred_at ASC
      LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function markMeetingAnalyzed(id: string, brief: string): Promise<void> {
  const p = await db();
  if (!p) return;
  await p.query(`UPDATE meetings SET brief = $1, analyzed_at = now() WHERE id = $2`, [brief, id]);
}

export async function markTranscriptAnalyzed(id: string, brief: string): Promise<void> {
  const p = await db();
  if (!p) return;
  await p.query(`UPDATE meeting_transcripts SET brief = $1, analyzed_at = now() WHERE id = $2`, [brief, id]);
}

export async function listInitiatives(includeClosed = false): Promise<Initiative[]> {
  const p = await db();
  if (!p) return [];
  const { rows } = await p.query<Initiative>(
    `SELECT ${INIT_RET} FROM initiatives
      ${includeClosed ? "" : "WHERE status = 'active'"}
      ORDER BY status, horizon DESC, last_seen_at DESC LIMIT 300`,
  );
  return rows;
}

export async function createInitiative(i: {
  title: string;
  slug: string;
  summary: string;
  horizon: Horizon;
  owner?: string | null;
  seenAt: string;
}): Promise<Initiative | null> {
  const p = await db();
  if (!p) return null;
  const { rows } = await p.query<Initiative>(
    `INSERT INTO initiatives (title, slug, summary, horizon, owner, first_seen_at, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT (slug) DO UPDATE
         SET summary = EXCLUDED.summary, last_seen_at = GREATEST(initiatives.last_seen_at, EXCLUDED.last_seen_at)
       RETURNING ${INIT_RET}`,
    [i.title, i.slug, i.summary, i.horizon, i.owner ?? null, i.seenAt],
  );
  return rows[0] ?? null;
}

export async function updateInitiative(
  slug: string,
  patch: { summary?: string; horizon?: Horizon; owner?: string | null; status?: InitiativeStatus; seenAt: string },
): Promise<Initiative | null> {
  const p = await db();
  if (!p) return null;
  const { rows } = await p.query<Initiative>(
    `UPDATE initiatives SET
        summary      = COALESCE($2, summary),
        horizon      = COALESCE($3, horizon),
        owner        = COALESCE($4, owner),
        status       = COALESCE($5, status),
        last_seen_at = GREATEST(last_seen_at, $6),
        updated_at   = now()
      WHERE slug = $1
      RETURNING ${INIT_RET}`,
    [slug, patch.summary ?? null, patch.horizon ?? null, patch.owner ?? null, patch.status ?? null, patch.seenAt],
  );
  return rows[0] ?? null;
}

export async function addMention(m: {
  initiativeId: string;
  meetingId: string;
  excerpt: string;
  changeNote?: string | null;
}): Promise<void> {
  const p = await db();
  if (!p) return;
  await p.query(
    `INSERT INTO initiative_mentions (initiative_id, meeting_id, excerpt, change_note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (initiative_id, meeting_id) DO UPDATE
         SET excerpt = EXCLUDED.excerpt, change_note = EXCLUDED.change_note`,
    [m.initiativeId, m.meetingId, m.excerpt, m.changeNote ?? null],
  );
}

export async function listMentions(initiativeId: string, limit = 20): Promise<InitiativeMention[]> {
  const p = await db();
  if (!p) return [];
  const { rows } = await p.query<InitiativeMention>(
    `SELECT n.id::text, n.initiative_id::text, n.meeting_id::text, n.excerpt, n.change_note,
            n.created_at::text, m.title AS meeting_title, m.occurred_at::text
       FROM initiative_mentions n
       JOIN meetings m ON m.id = n.meeting_id
      WHERE n.initiative_id = $1
      ORDER BY m.occurred_at DESC LIMIT $2`,
    [initiativeId, limit],
  );
  return rows;
}

/** Meeting briefs from the last N days — the digest's short-term memory. */
export async function recentBriefs(days = 7): Promise<{ title: string; occurred_at: string; brief: string }[]> {
  const p = await db();
  if (!p) return [];
  const { rows } = await p.query<{ title: string; occurred_at: string; brief: string }>(
    `SELECT m.title, m.occurred_at::text, t.brief
       FROM meeting_transcripts t
       JOIN meetings m ON m.id = t.meeting_id
      WHERE t.brief IS NOT NULL AND m.occurred_at > now() - ($1 || ' days')::interval
      ORDER BY m.occurred_at DESC LIMIT 40`,
    [String(days)],
  );
  return rows;
}

export async function getRollup(kind: "week" | "quarter", periodStart: string): Promise<string | null> {
  const p = await db();
  if (!p) return null;
  const { rows } = await p.query<{ narrative: string }>(
    `SELECT narrative FROM period_rollups WHERE period_kind = $1 AND period_start = $2`,
    [kind, periodStart],
  );
  return rows[0]?.narrative ?? null;
}

export async function saveRollup(kind: "week" | "quarter", periodStart: string, narrative: string): Promise<void> {
  const p = await db();
  if (!p) return;
  await p.query(
    `INSERT INTO period_rollups (period_kind, period_start, narrative) VALUES ($1, $2, $3)
       ON CONFLICT (period_kind, period_start) DO UPDATE SET narrative = EXCLUDED.narrative`,
    [kind, periodStart, narrative],
  );
}

export async function getDigest(sentFor: string): Promise<Digest | null> {
  const p = await db();
  if (!p) return null;
  const { rows } = await p.query<Digest>(
    `SELECT id::text, sent_for::text, subject, body_html, body_text, recipients,
            gmail_msg_id, sent_at::text, created_at::text
       FROM digests WHERE sent_for = $1`,
    [sentFor],
  );
  return rows[0] ?? null;
}

export async function listDigests(limit = 30): Promise<Omit<Digest, "body_html" | "body_text">[]> {
  const p = await db();
  if (!p) return [];
  const { rows } = await p.query<Omit<Digest, "body_html" | "body_text">>(
    `SELECT id::text, sent_for::text, subject, recipients, gmail_msg_id,
            sent_at::text, created_at::text
       FROM digests ORDER BY sent_for DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

/**
 * Claim the digest slot for a date. Returns null when one already exists —
 * the unique constraint on sent_for is what stops a double cron firing from
 * mailing the board twice.
 */
export async function claimDigest(d: {
  sentFor: string;
  subject: string;
  html: string;
  text: string;
  recipients: string;
}): Promise<string | null> {
  const p = await db();
  if (!p) return null;
  const { rows } = await p.query<{ id: string }>(
    `INSERT INTO digests (sent_for, subject, body_html, body_text, recipients)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (sent_for) DO NOTHING
       RETURNING id::text`,
    [d.sentFor, d.subject, d.html, d.text, d.recipients],
  );
  return rows[0]?.id ?? null;
}

export async function markDigestSent(id: string, gmailMsgId: string): Promise<void> {
  const p = await db();
  if (!p) return;
  await p.query(`UPDATE digests SET gmail_msg_id = $1, sent_at = now() WHERE id = $2`, [gmailMsgId, id]);
}

import { Pool } from "pg";
import { env } from "@/lib/env";

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
        CREATE TABLE IF NOT EXISTS google_tokens (
          id           TEXT PRIMARY KEY,
          data         TEXT NOT NULL,
          updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `)
      .then(() => undefined)
      .catch((e) => {
        schemaReady = null; // allow retry on next call
        throw e;
      });
  }
  return schemaReady;
}

/** Returns a ready pool (schema ensured), or null if DB isn't configured. */
export async function db(): Promise<Pool | null> {
  const p = getPool();
  if (!p) return null;
  await ensureSchema(p);
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

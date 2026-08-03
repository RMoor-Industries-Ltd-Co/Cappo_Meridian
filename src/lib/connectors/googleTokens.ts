import { promises as fs } from "node:fs";
import path from "node:path";
import type { Auth } from "googleapis";
import { db } from "@/lib/db";

/**
 * Persistence for Google OAuth credentials, keyed by account.
 *
 * Two things this fixes over the original single-file store:
 *
 * 1. MULTI-ACCOUNT. The meeting archive is owned by one Workspace account
 *    (amg@apex-meridian-group.com) while other connector work may run as a
 *    different one. A single unkeyed blob cannot hold both — connecting the
 *    second silently evicts the first.
 * 2. SURVIVAL. `.google-tokens.json` sits in the container's working directory,
 *    so every redeploy dropped the refresh token and forced a re-authorize.
 *    When DATABASE_URL is set, tokens live in Postgres and survive.
 *
 * The file store remains as the no-database fallback (local dev), and a legacy
 * unkeyed file is adopted once into the default account rather than stranded.
 */

type Credentials = Auth.Credentials;

/** The account used when a caller doesn't name one. */
export const DEFAULT_ACCOUNT = "default";

/** The Workspace account that owns the meeting archive folder. */
export const ARCHIVE_ACCOUNT = "archive";

/**
 * Account keys are used as primary keys and as OAuth `state`. Since `state`
 * returns through the browser, it has to be validated before it selects a
 * storage slot — an unchecked value would let a crafted authorize link write
 * credentials wherever it liked.
 */
export function isValidAccountKey(key: string): boolean {
  return /^[a-zA-Z0-9._@-]{1,64}$/.test(key);
}

const TOKEN_PATH =
  process.env.TOKEN_STORE_PATH || path.join(process.cwd(), ".google-tokens.json");

/** Shape of the keyed file store: { [account]: Credentials }. */
type FileStore = Record<string, Credentials>;

/**
 * A legacy store is the bare Credentials object written by the original
 * implementation. It's distinguishable from the keyed map by its own fields —
 * a keyed map's values are objects, never token strings.
 */
function isLegacy(parsed: unknown): parsed is Credentials {
  if (!parsed || typeof parsed !== "object") return false;
  const o = parsed as Record<string, unknown>;
  return typeof o.access_token === "string" || typeof o.refresh_token === "string";
}

async function readFileStore(): Promise<FileStore> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(TOKEN_PATH, "utf8"));
    if (isLegacy(parsed)) return { [DEFAULT_ACCOUNT]: parsed };
    return (parsed ?? {}) as FileStore;
  } catch {
    return {};
  }
}

async function writeFileStore(store: FileStore): Promise<void> {
  await fs.writeFile(TOKEN_PATH, JSON.stringify(store, null, 2), "utf8");
}

/**
 * Persist credentials for an account.
 *
 * Writes are MERGED, not replaced: a token refresh returns only the fields that
 * changed, and Google issues a refresh_token just once (on the first consent).
 * Overwriting wholesale would drop it and make the connection un-refreshable
 * the moment the access token expired.
 */
export async function saveTokens(
  tokens: Credentials,
  account: string = DEFAULT_ACCOUNT,
): Promise<void> {
  const existing = (await loadTokens(account)) ?? {};
  const merged: Credentials = { ...existing, ...tokens };
  if (!merged.refresh_token && existing.refresh_token) {
    merged.refresh_token = existing.refresh_token;
  }

  const pool = await db();
  if (pool) {
    await pool.query(
      `INSERT INTO google_tokens (account, data, updated_at)
         VALUES ($1, $2, now())
       ON CONFLICT (account) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [account, JSON.stringify(merged)],
    );
    return;
  }

  const store = await readFileStore();
  store[account] = merged;
  await writeFileStore(store);
}

export async function loadTokens(account: string = DEFAULT_ACCOUNT): Promise<Credentials | null> {
  const pool = await db();
  if (pool) {
    const { rows } = await pool.query<{ data: string }>(
      `SELECT data FROM google_tokens WHERE account = $1`,
      [account],
    );
    if (rows[0]) {
      try {
        return JSON.parse(rows[0].data) as Credentials;
      } catch {
        return null;
      }
    }
    // Nothing in Postgres yet. A pre-existing file store (from before tokens
    // moved to the database, or from a mounted volume) is adopted once so the
    // switch doesn't present as a disconnected connector.
    const adopted = (await readFileStore())[account];
    if (adopted) {
      await pool.query(
        `INSERT INTO google_tokens (account, data, updated_at)
           VALUES ($1, $2, now()) ON CONFLICT (account) DO NOTHING`,
        [account, JSON.stringify(adopted)],
      );
      return adopted;
    }
    return null;
  }

  return (await readFileStore())[account] ?? null;
}

export async function hasTokens(account: string = DEFAULT_ACCOUNT): Promise<boolean> {
  return (await loadTokens(account)) !== null;
}

/** Accounts with stored credentials, for the connector status UI. */
export async function listAccounts(): Promise<string[]> {
  const pool = await db();
  if (pool) {
    const { rows } = await pool.query<{ account: string }>(
      `SELECT account FROM google_tokens ORDER BY account`,
    );
    return rows.map((r) => r.account);
  }
  return Object.keys(await readFileStore()).sort();
}

/** Forget one account's credentials (disconnect). */
export async function clearTokens(account: string = DEFAULT_ACCOUNT): Promise<void> {
  const pool = await db();
  if (pool) {
    await pool.query(`DELETE FROM google_tokens WHERE account = $1`, [account]);
    return;
  }
  const store = await readFileStore();
  delete store[account];
  await writeFileStore(store);
}

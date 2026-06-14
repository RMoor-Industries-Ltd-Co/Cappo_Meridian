import { promises as fs } from "node:fs";
import path from "node:path";
import { google, type Auth } from "googleapis";
import { env, isGoogleConfigured, isDbConfigured } from "@/lib/env";
import { loadGoogleToken, saveGoogleToken } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

// Use the google-auth-library types bundled with `googleapis` so they match the
// clients passed to google.drive()/google.gmail() (avoids a duplicate copy).
type OAuth2Client = Auth.OAuth2Client;
type Credentials = Auth.Credentials;

/**
 * Shared Google OAuth setup for the Drive and Gmail connectors.
 *
 * Token persistence: when a database is configured (DATABASE_URL) tokens are
 * stored in Postgres, encrypted at rest (AES-256-GCM via SECRET_ENCRYPTION_KEY).
 * Otherwise — local dev with no DB — they fall back to a gitignored JSON file.
 *
 * AMG uses a single shared Google Workspace account (the company Drive archive +
 * Gmail), so tokens live under one row; the table is keyed so this can extend to
 * per-user connections later.
 */

// Single shared-account row key in the google_tokens table.
const TOKEN_ID = "shared";

// Dev fallback file. Configurable so a non-DB deploy can still persist on a
// mounted volume (TOKEN_STORE_PATH=/data/google-tokens.json) vs the ephemeral cwd.
const TOKEN_PATH =
  process.env.TOKEN_STORE_PATH || path.join(process.cwd(), ".google-tokens.json");

// Drive read + Gmail read, plus basic profile. Widen as features land.
export const GOOGLE_SCOPES = [
  // Full Drive access so the Drive module can read AND write (CRUD) files.
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

export function createOAuthClient(): OAuth2Client {
  if (!isGoogleConfigured()) throw new Error("Google OAuth client not configured");
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );
}

export function buildAuthUrl(): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline", // request a refresh token
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    hd: env.GOOGLE_WORKSPACE_DOMAIN, // hint the apex-meridian-group.com workspace
  });
}

export async function saveTokens(tokens: Credentials): Promise<void> {
  if (isDbConfigured()) {
    await saveGoogleToken(TOKEN_ID, encryptSecret(JSON.stringify(tokens)));
    return;
  }
  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf8");
}

export async function loadTokens(): Promise<Credentials | null> {
  if (isDbConfigured()) {
    const stored = await loadGoogleToken(TOKEN_ID);
    if (!stored) return null;
    try {
      return JSON.parse(decryptSecret(stored)) as Credentials;
    } catch {
      return null;
    }
  }
  try {
    return JSON.parse(await fs.readFile(TOKEN_PATH, "utf8")) as Credentials;
  } catch {
    return null;
  }
}

export async function hasTokens(): Promise<boolean> {
  return (await loadTokens()) !== null;
}

/** Returns an authorized client, or null if the user hasn't connected yet. */
export async function getAuthorizedClient(): Promise<OAuth2Client | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;
  const client = createOAuthClient();
  client.setCredentials(tokens);
  // Persist refreshed access tokens automatically.
  client.on("tokens", (refreshed: Credentials) => {
    void saveTokens({ ...tokens, ...refreshed });
  });
  return client;
}

import { google, type Auth } from "googleapis";
import { env, isGoogleConfigured } from "@/lib/env";
import { DEFAULT_ACCOUNT, loadTokens, saveTokens } from "./googleTokens";

// Use the google-auth-library types bundled with `googleapis` so they match the
// clients passed to google.drive()/google.gmail() (avoids a duplicate copy).
type OAuth2Client = Auth.OAuth2Client;
type Credentials = Auth.Credentials;

/**
 * Shared Google OAuth setup for the Drive, Gmail, and Sheets connectors.
 *
 * Token persistence lives in `./googleTokens` — keyed by account and backed by
 * Postgres when available, so several Workspace accounts can be connected at
 * once and credentials survive a container redeploy.
 */

export { clearTokens, hasTokens, listAccounts, loadTokens, saveTokens } from "./googleTokens";

// Drive CRUD + Gmail organize (label/archive/trash — gmail.modify, not permanent-delete),
// plus basic profile. Widen as features land.
export const GOOGLE_SCOPES = [
  // Full Drive access so the Drive module can read AND write (CRUD) files.
  // This also covers Drive's files.export (Docs → text), which is how Gemini
  // meeting transcripts are read.
  "https://www.googleapis.com/auth/drive",
  // gmail.modify = read + label/archive/mark-read/trash (recoverable). Not full delete.
  "https://www.googleapis.com/auth/gmail.modify",
  // Implied by the full `drive` scope, but naming it keeps the consent screen
  // honest about the app touching spreadsheets (the meeting archive's database).
  "https://www.googleapis.com/auth/spreadsheets",
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

/**
 * Build the consent URL. The target account is round-tripped through OAuth
 * `state` so the callback knows which key to store the result under — without
 * it, authorizing a second account would overwrite the first.
 */
export function buildAuthUrl(account: string = DEFAULT_ACCOUNT): string {
  const client = createOAuthClient();
  // NOTE: no `hd` parameter. generateAuthUrl() rejects unknown keys into the
  // authorize URL in a way Google answers with `Error 400: invalid_request`,
  // which broke the connector flow exactly as it broke app sign-in. The
  // workspace restriction belongs on the OAuth client / account chooser, not
  // here.
  return client.generateAuthUrl({
    access_type: "offline", // request a refresh token
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state: account,
  });
}

/** Returns an authorized client, or null if that account hasn't connected yet. */
export async function getAuthorizedClient(
  account: string = DEFAULT_ACCOUNT,
): Promise<OAuth2Client | null> {
  const tokens = await loadTokens(account);
  if (!tokens) return null;
  const client = createOAuthClient();
  client.setCredentials(tokens);
  // Persist refreshed access tokens automatically, back to the same account.
  // saveTokens merges, so the refresh_token issued at first consent survives a
  // refresh response that omits it.
  client.on("tokens", (refreshed: Credentials) => {
    void saveTokens(refreshed, account);
  });
  return client;
}

/**
 * The account that owns the meeting archive, falling back to the default
 * connection when a dedicated archive account hasn't been authorized. One
 * connected Workspace account is the common case; the fallback keeps that
 * working without forcing a second authorize.
 */
export async function getArchiveClient(): Promise<OAuth2Client | null> {
  const preferred = env.MEETING_ARCHIVE_ACCOUNT;
  if (preferred) {
    const client = await getAuthorizedClient(preferred);
    if (client) return client;
  }
  return getAuthorizedClient(DEFAULT_ACCOUNT);
}

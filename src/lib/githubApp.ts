import { createSign } from "node:crypto";
import { env } from "@/lib/env";

/**
 * GitHub App auth for Cappo's ONE permitted write action: appending a row to
 * rmg-piaar-system's docs/INITIATIVES.md (agent.ts's add_initiative tool). Mirrors
 * rmg-ai's tools_github.py exactly -- same allen-piaar-control-bot App identity
 * (already installed org-wide), RS256 JWT -> installation access token, restricted at
 * the tool layer to this one file rather than by GitHub permissions, since the App
 * itself is shared across services. No jsonwebtoken dependency -- built with
 * node:crypto, same as this repo's other from-scratch auth (agentAuth.ts).
 */

const API = "https://api.github.com";
const ORG = "RMoor-Industries-Ltd-Co";
const INITIATIVES_REPO = "rmg-piaar-system";
const INITIATIVES_PATH = "docs/INITIATIVES.md";

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function appJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iat: now - 60, exp: now + 9 * 60, iss: env.GITHUB_APP_ID };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const key = (env.GITHUB_APP_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = base64url(signer.sign(key));
  return `${signingInput}.${signature}`;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function installationToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.token;
  const res = await fetch(`${API}/app/installations/${env.GITHUB_APP_INSTALLATION_ID}/access_tokens`, {
    method: "POST",
    headers: { Authorization: `Bearer ${appJwt()}`, Accept: "application/vnd.github+json" }
  });
  if (!res.ok) throw new Error(`GitHub App auth failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { token: string; expires_at: string };
  const parsedExpiry = new Date(data.expires_at).getTime();
  tokenCache = { token: data.token, expiresAt: Number.isFinite(parsedExpiry) ? parsedExpiry : Date.now() + 55 * 60_000 };
  return tokenCache.token;
}

export function githubReady(): boolean {
  return Boolean(env.GITHUB_APP_ID && env.GITHUB_APP_INSTALLATION_ID && env.GITHUB_APP_PRIVATE_KEY);
}

export type InitiativeRow = {
  initiative: string;
  repos: string;
  branch: string;
  status: string;
  owner: string;
  goal: string;
};

/** Appends one new row to rmg-piaar-system's docs/INITIATIVES.md. Finds the highest
 * existing row number and inserts the new row immediately after the last one, leaving
 * everything else in the file untouched. */
export async function addInitiative(row: InitiativeRow): Promise<string> {
  if (!githubReady()) throw new Error("github_not_configured");
  const token = await installationToken();
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };

  const getRes = await fetch(`${API}/repos/${ORG}/${INITIATIVES_REPO}/contents/${INITIATIVES_PATH}`, { headers });
  if (!getRes.ok) throw new Error(`Could not read INITIATIVES.md: ${getRes.status}`);
  const file = (await getRes.json()) as { content: string; sha: string };
  const content = Buffer.from(file.content, "base64").toString("utf8");

  const lines = content.split("\n");
  const rowPattern = /^\|\s*(\d+)\s*\|/;
  let lastRowIndex = -1;
  let maxNum = -1;
  lines.forEach((line, i) => {
    const m = line.match(rowPattern);
    if (m) {
      lastRowIndex = i;
      maxNum = Math.max(maxNum, parseInt(m[1], 10));
    }
  });
  if (lastRowIndex === -1) throw new Error("Could not find the initiatives table in INITIATIVES.md");

  const nextNum = maxNum + 1;
  const sanitize = (s: string) => s.replace(/\|/g, "/").replace(/\n/g, " ").trim();
  const newRow = `| ${nextNum} | ${sanitize(row.initiative)} | ${sanitize(row.repos)} | ${sanitize(row.branch)} | ${sanitize(row.status)} | ${sanitize(row.owner)} | ${sanitize(row.goal)} |`;
  lines.splice(lastRowIndex + 1, 0, newRow);
  const updated = lines.join("\n");

  const putRes = await fetch(`${API}/repos/${ORG}/${INITIATIVES_REPO}/contents/${INITIATIVES_PATH}`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Add initiative #${nextNum}: ${sanitize(row.initiative)} (via Cappo)`,
      content: Buffer.from(updated, "utf8").toString("base64"),
      sha: file.sha
    })
  });
  if (!putRes.ok) throw new Error(`Could not update INITIATIVES.md: ${putRes.status} ${await putRes.text()}`);
  const result = (await putRes.json()) as { commit?: { html_url?: string } };
  return `Added initiative #${nextNum} "${sanitize(row.initiative)}" to rmg-piaar-system's INITIATIVES.md.${result.commit?.html_url ? " " + result.commit.html_url : ""}`;
}

import { z } from "zod";

/**
 * Central, validated configuration for Cappo_Meridian.
 *
 * Every integration credential is optional so the app always boots — the
 * dashboard reflects which connectors are actually configured. Use the typed
 * `env` export everywhere instead of reading `process.env` directly.
 */
const schema = z.object({
  // App
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  GOOGLE_WORKSPACE_DOMAIN: z.string().default("apex-meridian-group.com"),
  // Comma-separated personal emails always allowed to sign in (bypasses Workspace domain gate)
  PARTNER_EMAILS: z.string().optional(),
  // The two founders' login emails — always allowed to sign in, and mapped to
  // their founder identity (see lib/founders.ts). Any email domain is fine.
  FOUNDER_55_EMAIL: z.string().optional(),
  FOUNDER_88_EMAIL: z.string().optional(),

  // ClickUp — personal API token (https://app.clickup.com/settings/apps)
  CLICKUP_API_TOKEN: z.string().optional(),
  CLICKUP_TEAM_ID: z.string().optional(),
  // Scope tasks/calendar to a single ClickUp Space (the AMG space). When unset,
  // the whole workspace is used.
  CLICKUP_SPACE_ID: z.string().optional(),

  // Notion — internal integration token (https://www.notion.so/my-integrations)
  NOTION_API_KEY: z.string().optional(),

  // Google (Drive + Gmail) — OAuth 2.0 client.
  // The same client is reused for app login (Auth.js) and connector
  // authorization; both redirect URIs must be registered on it.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:3000/api/connectors/google/callback"),

  // Auth.js — session signing secret (generate: `openssl rand -base64 32`)
  AUTH_SECRET: z.string().optional(),

  // Anthropic — shared AMG Claude account, powers the AI research module
  ANTHROPIC_API_KEY: z.string().optional(),
  // Claude Code reserves ANTHROPIC_API_KEY in its env; CLAUDE_API_KEY is the
  // dev-only fallback so Claude can be validated inside a Claude Code session.
  CLAUDE_API_KEY: z.string().optional(),
  // Override the default Claude model (defaults to claude-sonnet-4-6).
  CLAUDE_MODEL: z.string().optional(),

  // OpenAI — optional AI provider on the AI page (model switcher)
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),

  // Perplexity — optional AI provider (OpenAI-compatible) with its own model
  // switcher (Sonar family). PERPLEXITY_MODEL overrides the default sonar-pro.
  PERPLEXITY_API_KEY: z.string().optional(),
  PERPLEXITY_MODEL: z.string().optional(),

  // Postgres — persistence (AI research projects + conversations, etc.)
  DATABASE_URL: z.string().optional(),

  // Machine-to-machine agent key — lets ALLIE (allen.i.verse) delegate AMG tasks to
  // Cappo's /api/agent server-to-server, separate from the human Google login.
  AGENT_API_KEY: z.string().optional(),

  // Vale — HVN Havenry's public-facing concierge. Cappo pulls her cached HVN<->AMG
  // activity report directly (see agent.ts's vale_get_report tool) for HVN<->AMG
  // business coordination. Separate key from AGENT_API_KEY above, since it's Vale's
  // AGENT_API_KEY on the hvnhavenry-com side, not Cappo's own.
  VALE_REPORT_URL: z.string().optional(),
  VALE_AGENT_KEY: z.string().optional(),

  // GitHub App identity for Cappo's ONE permitted write: appending a row to
  // rmg-piaar-system's docs/INITIATIVES.md (add_initiative tool, src/lib/githubApp.ts).
  // Reuses the same allen-piaar-control-bot App identity rmg-ai's ALLEN uses (already
  // installed org-wide) -- the restriction to that one file lives at the tool layer here,
  // same pattern as ALLEN's own tools_github.py CONTENTS_WRITE_REPOS allowlist.
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_INSTALLATION_ID: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),

  // Secret-at-rest key — encrypts Google OAuth tokens stored in Postgres
  // (AES-256-GCM). Any passphrase works (SHA-256 derived). Set in production.
  SECRET_ENCRYPTION_KEY: z.string().optional(),

  // GrantOps automation — Drive parent folder new grant-application folders are
  // created under (the "Grant Applications" home). When a grant is CAPPO-approved,
  // Cappo natively creates the folder + draft docs here via the shared Google
  // connection. Unset = folders are created in My Drive root.
  GRANTOPS_DRIVE_PARENT_FOLDER_ID: z.string().optional(),
  // GrantOps entity knowledge bank — the AMG legal Drive folder that holds per-entity
  // context documents Cappo reads when drafting/briefing. Each entity gets a subfolder
  // here. Unset = a built-in default AMG legal folder id (see grantops/knowledge.ts).
  GRANTOPS_KNOWLEDGE_FOLDER_ID: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Misconfigured *types* (not missing optionals) are a hard failure.
  console.error("❌ Invalid environment configuration:", z.treeifyError(parsed.error));
  throw new Error("Invalid environment configuration — see logs above.");
}

export const env = parsed.data;

export const isGoogleConfigured = () =>
  Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

/** App login (Auth.js) is usable only when the OAuth client + secret are set. */
export const isAuthConfigured = () =>
  Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.AUTH_SECRET);

/** The AI research module is live when at least one AI provider is configured. */
export const isAiConfigured = () =>
  Boolean(
    env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY || env.OPENAI_API_KEY || env.PERPLEXITY_API_KEY,
  );

/** Persistence is available only when a database URL is set. */
export const isDbConfigured = () => Boolean(env.DATABASE_URL);

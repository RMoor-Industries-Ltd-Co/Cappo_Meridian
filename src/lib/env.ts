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

  // Secret-at-rest key — encrypts Google OAuth tokens stored in Postgres
  // (AES-256-GCM). Any passphrase works (SHA-256 derived). Set in production.
  SECRET_ENCRYPTION_KEY: z.string().optional(),
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

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

  // Notion — internal integration token (https://www.notion.so/my-integrations)
  NOTION_API_KEY: z.string().optional(),

  // Google (Drive + Gmail) — OAuth 2.0 client
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:3000/api/auth/google/callback"),
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

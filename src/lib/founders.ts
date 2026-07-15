import { env } from "@/lib/env";

/**
 * Founder identity, keyed off the FOUNDER_55_EMAIL / FOUNDER_88_EMAIL env vars.
 * These two addresses are always allowed to sign in (see auth.ts) and map to a
 * founder label — the basis for the personalized Overview (welcome + daily
 * quote). This is the sanctioned exception to the "identical UI for everyone"
 * rule in CLAUDE.md: identity only changes the greeting, not the modules.
 */
export type FounderLabel = "Founder 55" | "Founder 88";

const F55 = (env.FOUNDER_55_EMAIL ?? "").trim().toLowerCase();
const F88 = (env.FOUNDER_88_EMAIL ?? "").trim().toLowerCase();

/** Configured founder login emails (lowercased), for the sign-in allow-list. */
export const FOUNDER_EMAILS: string[] = [F55, F88].filter(Boolean);

/** Which founder an email belongs to, or null if it isn't a configured founder. */
export function founderForEmail(email?: string | null): FounderLabel | null {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return null;
  if (e === F88) return "Founder 88";
  if (e === F55) return "Founder 55";
  return null;
}

import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

// Constant-time string compare -- a plain `===`/`!==` on a secret leaks timing
// information proportional to how many leading characters match, which an attacker
// can use to brute-force the key character-by-character. Mirrors axis-tekhen's
// hmac.compare_digest pattern for the same class of shared-secret check.
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Validates the x-agent-key header against AGENT_API_KEY (ALLIE's shared M2M secret).
 * This is the ONLY way into /api/agent* -- there is no other public surface for them. */
export function isAgentAuthorized(key: string | null): boolean {
  const expected = env.AGENT_API_KEY;
  if (!expected || !key) return false;
  return safeEqual(key, expected);
}

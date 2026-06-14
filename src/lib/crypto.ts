import crypto from "node:crypto";
import { env } from "@/lib/env";

/**
 * Small symmetric-encryption helper for secrets at rest (e.g. Google OAuth
 * tokens stored in Postgres).
 *
 * Uses AES-256-GCM with a key derived (SHA-256) from SECRET_ENCRYPTION_KEY, so
 * any passphrase length works. When no key is configured the value is stored
 * with a `plain:` marker instead — keeps local dev frictionless while making it
 * obvious the value is not encrypted. Set SECRET_ENCRYPTION_KEY in production.
 */

const ALG = "aes-256-gcm";

function key(): Buffer | null {
  const raw = env.SECRET_ENCRYPTION_KEY;
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest();
}

/** Encrypt a UTF-8 string. Returns a self-describing, storable token. */
export function encryptSecret(plain: string): string {
  const k = key();
  if (!k) return `plain:${plain}`;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, k, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `gcm:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

/** Decrypt a value produced by {@link encryptSecret}. */
export function decryptSecret(stored: string): string {
  if (stored.startsWith("plain:")) return stored.slice("plain:".length);
  if (stored.startsWith("gcm:")) {
    const k = key();
    if (!k) throw new Error("SECRET_ENCRYPTION_KEY is required to decrypt this value");
    const [, ivB64, tagB64, ctB64] = stored.split(":");
    const decipher = crypto.createDecipheriv(ALG, k, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }
  // Unmarked legacy value — treat as plaintext.
  return stored;
}

/**
 * The meeting archive's naming convention.
 *
 *     CATEGORY_YYYYMMDD_HHMMSS-HHMMSS
 *     GROWTH_20260715_140000-150000
 *
 * Every archived transcript and every Database row is keyed by this string, so
 * the same meeting recorded by four services lands on four files that sort
 * together and reconcile to one row.
 *
 * Four decisions the format itself doesn't specify, fixed here:
 *
 * 1. TIMEZONE is America/New_York, always. Formatting in the server's local
 *    zone would silently shift filenames when the container moves or DST flips,
 *    and a key that changes is a key that duplicates.
 * 2. CATEGORY is a closed vocabulary (see CATEGORIES). Left open, an extraction
 *    model invents SYNC, CHECKIN, and CHECK_IN as three separate categories
 *    within a week. Unknown input falls back to GENERAL rather than inventing.
 * 3. CROSS-MIDNIGHT meetings keep the start date and carry an end time that is
 *    numerically smaller (…20260715_233000-001500). Parsers must not assume
 *    end > start.
 * 4. UNKNOWN DURATION repeats the start time rather than assuming a length.
 *    A meeting with no end signal is recorded as `140000-140000`, which is
 *    visibly odd on purpose — inventing a plausible 60 minutes would put a
 *    fabricated number somewhere it can never be distinguished from a real one.
 *    Callers should carry `durationKnown: false` into the Database row.
 */

export const ARCHIVE_TZ = "America/New_York";

/**
 * The seed vocabulary. This is the compiled-in default; the archive
 * spreadsheet's `Categories` tab overrides it at runtime so the vocabulary can
 * change without a deploy.
 */
export const CATEGORIES = [
  "GROWTH",
  "OPS",
  "PRODUCT",
  "SUPPLY",
  "FINANCE",
  "LEGAL",
  "MARKETING",
  "SALES",
  "HIRING",
  "PARTNER",
  "BOARD",
  "GENERAL",
] as const;

export type Category = (typeof CATEGORIES)[number] | string;

/** The category assigned when nothing else matches. Never guess beyond this. */
export const FALLBACK_CATEGORY = "GENERAL";

/**
 * Force an arbitrary string into a legal category token: uppercase, A-Z0-9
 * only. Returns null when nothing survives, so callers apply FALLBACK_CATEGORY
 * deliberately rather than inheriting an empty string.
 */
export function sanitizeCategory(raw: string): string | null {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.length ? cleaned.slice(0, 24) : null;
}

/**
 * Resolve a model-proposed category against the allowed vocabulary. Anything
 * outside it becomes GENERAL — an unrecognized category is a miss, not a new
 * category, and letting it through is how the vocabulary sprawls.
 */
export function resolveCategory(raw: string | null | undefined, allowed: readonly string[] = CATEGORIES): string {
  if (!raw) return FALLBACK_CATEGORY;
  const token = sanitizeCategory(raw);
  if (!token) return FALLBACK_CATEGORY;
  return allowed.includes(token) ? token : FALLBACK_CATEGORY;
}

interface WallClock {
  yyyymmdd: string;
  hhmmss: string;
}

/**
 * Project an instant onto the America/New_York wall clock.
 *
 * `hourCycle: "h23"` rather than `hour12: false` — the latter renders midnight
 * as hour 24 on some ICU builds, which would produce 240000 and a key that
 * never round-trips.
 */
function wallClock(d: Date): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ARCHIVE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    yyyymmdd: `${get("year")}${get("month")}${get("day")}`,
    hhmmss: `${get("hour")}${get("minute")}${get("second")}`,
  };
}

export interface MeetingKeyInput {
  category: string;
  start: Date;
  /** Omit when the source gives no end signal — the key repeats the start. */
  end?: Date | null;
}

export interface ParsedMeetingKey {
  category: string;
  /** Calendar date in the archive timezone, as YYYY-MM-DD. */
  date: string;
  start: string;
  end: string;
  /** False when the key encodes an unknown duration (start === end). */
  durationKnown: boolean;
  /** Collision suffix (`_2`, `_3`, …), or 0 when this is the primary key. */
  sequence: number;
}

/**
 * Build the canonical key. The date always comes from the START instant, so a
 * meeting running past midnight files under the day it began.
 */
export function formatMeetingKey({ category, start, end }: MeetingKeyInput): string {
  const s = wallClock(start);
  const e = end ? wallClock(end) : s;
  const token = sanitizeCategory(category) ?? FALLBACK_CATEGORY;
  return `${token}_${s.yyyymmdd}_${s.hhmmss}-${e.hhmmss}`;
}

const KEY_RE = /^([A-Z0-9]{1,24})_(\d{8})_(\d{6})-(\d{6})(?:_(\d+))?$/;

/** Parse a key (with or without a collision suffix, with or without extension). */
export function parseMeetingKey(name: string): ParsedMeetingKey | null {
  const bare = name.replace(/\.[a-z0-9]+$/i, "");
  const m = KEY_RE.exec(bare);
  if (!m) return null;
  const [, category, ymd, start, end, seq] = m;
  return {
    category,
    date: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`,
    start,
    end,
    durationKnown: start !== end,
    sequence: seq ? Number(seq) : 0,
  };
}

/**
 * Disambiguate a key against keys already taken.
 *
 * Two genuinely different meetings can share a category and a start second
 * (back-to-back calendar entries with rounded times are the common case).
 * Appending `_2`, `_3`, … keeps both rather than letting the second silently
 * overwrite the first.
 */
export function disambiguate(key: string, taken: ReadonlySet<string>): string {
  if (!taken.has(key)) return key;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${key}_${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`Cannot disambiguate meeting key after 999 collisions: ${key}`);
}

/** The archive stores transcripts as plain text — one file per service per meeting. */
export function transcriptFilename(key: string): string {
  return `${key}.txt`;
}

/**
 * Shared parsing helpers for the Notion-backed training corpus (new Lexicon
 * properties: Training Sentences, Professional Scenarios, Transition Phrases,
 * Reveal Guidance, Word Bank Distractors, Training Audiences, Training
 * Difficulty, Corpus Status). One place to parse these so `connectors/lexicon.ts`
 * (Notion -> Postgres) and `training/sentenceCorpus.ts` (Postgres -> game) never
 * duplicate ad hoc newline/comma-splitting logic.
 */

/** Known, Founder-approved training-audience tags (Lexicon-Lingo directive §4). */
export const TRAINING_AUDIENCES = [
  "General",
  "Customer",
  "Supplier",
  "Wholesaler",
  "Designer",
  "Manufacturer",
  "Olfactory Specialist",
] as const;
export type TrainingAudience = (typeof TRAINING_AUDIENCES)[number];

/** Corpus authoring workflow status (directive §4, §12). Unknown/unset -> "seed" (conservative, never silently "approved"). */
export type CorpusStatus = "seed" | "review" | "approved";

/** Splits a Notion text field on newlines (and, as a convenience, semicolons), trimming and dropping empties. */
export function splitEntries(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n|;/)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter((line) => line.length > 0);
}

/** Splits a comma/newline-separated tag list (Professional Scenarios, Word Bank Distractors, Training Audiences). */
export function splitTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n|,/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

/** Normalizes free-form audience tags against the known enum; unrecognized tags are dropped (not invented). */
export function parseTrainingAudiences(raw: string | null | undefined): TrainingAudience[] {
  const known = new Map(TRAINING_AUDIENCES.map((a) => [a.toLowerCase(), a]));
  const seen = new Set<TrainingAudience>();
  for (const tag of splitTags(raw)) {
    const match = known.get(tag.toLowerCase());
    if (match) seen.add(match);
  }
  return Array.from(seen);
}

/** Parses "Seed" / "Review" / "Approved" (any case); defaults to the conservative "seed" for unset/unrecognized values. */
export function parseCorpusStatus(raw: string | null | undefined): CorpusStatus {
  const normalized = (raw ?? "").trim().toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "review") return "review";
  return "seed";
}

const DIFFICULTY_WORDS: Record<string, number> = {
  easy: 2,
  medium: 5,
  advanced: 8,
};

/** Parses a 1-10 numeric difficulty, or the words easy/medium/advanced onto that scale. Returns null when unset/unparseable. */
export function parseTrainingDifficulty(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const normalized = raw.trim();
  const asNumber = Number(normalized);
  if (Number.isFinite(asNumber) && normalized !== "") {
    return Math.max(1, Math.min(10, Math.round(asNumber)));
  }
  const word = DIFFICULTY_WORDS[normalized.toLowerCase()];
  return word ?? null;
}

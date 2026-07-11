import { getLexiconTerms } from "@/lib/connectors/lexicon";
import { upsertLexiconTerms, logLexiconSync, listLexiconTerms } from "@/lib/db";
import {
  LEXICON_TERMS as STATIC_TERMS,
  CATEGORIES as STATIC_CATEGORIES,
  imagesForTerm,
  canonicalTerm,
  type LexiconEntry,
} from "@/lib/lexicon-data";

export interface LexiconSyncResult {
  added: number;
  updated: number;
  total: number;
}

/**
 * Pulls the current term list from the HVN Lexicon Notion page and upserts it into
 * Postgres (keyed by Notion block id), so edits made directly in Notion — the team's
 * source of truth — show up in the Cappo Lexicon view and Training quiz without
 * anyone touching this repo.
 */
export async function syncLexiconFromNotion(): Promise<LexiconSyncResult> {
  try {
    const terms = await getLexiconTerms();
    const { added, updated } = await upsertLexiconTerms(
      terms.map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        meaning: t.meaning,
        use: t.use,
        plainMeaning: t.plainMeaning,
        example: t.example,
      })),
    );
    await logLexiconSync({ added, updated, total: terms.length });
    return { added, updated, total: terms.length };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await logLexiconSync({ added: 0, updated: 0, total: 0, error });
    throw err;
  }
}

/**
 * Terms for the Lexicon page and Training quiz — the Notion-synced Postgres copy
 * when there is one, falling back to the static bundled list (local dev without a
 * database, or before the first sync has ever run).
 */
export async function getLexiconEntries(): Promise<{ terms: LexiconEntry[]; categories: string[] }> {
  const stored = await listLexiconTerms();
  if (stored.length === 0) {
    return { terms: STATIC_TERMS, categories: STATIC_CATEGORIES };
  }
  // The Notion-synced DB doesn't carry term images, so graft the gallery on by
  // name from the static catalogue (TERM_IMAGES) — where images are curated.
  const terms: LexiconEntry[] = stored.map((t) => {
    const name = canonicalTerm(t.name);
    return {
      term: name,
      meaning: t.meaning ?? "",
      use: t.use_case ?? "",
      plain: t.plain_meaning ?? "",
      example: t.example ?? "",
      images: imagesForTerm(name),
      category: t.category,
    };
  });
  const categories = Array.from(new Set(terms.map((t) => t.category))).sort();
  return { terms, categories };
}

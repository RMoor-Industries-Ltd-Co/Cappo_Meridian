import type { LexiconEntry } from "@/lib/lexicon-data";
import { shuffle } from "./shuffle";
import { MATCH_CONFUSABLE_ROUND, MATCH_CREATIVE_SPLIT_ROUND, matchPairCountForRound } from "./config";

/**
 * Splits a term pool into an "easy" half (shorter term + plain-meaning text —
 * usually single concrete nouns) and a "creative" half (longer, more
 * abstract/compound phrases). Matches the split already used by the original
 * Term Match rounds 1-5 vs 6-10.
 */
export function splitByDifficulty(terms: LexiconEntry[]): { easy: LexiconEntry[]; creative: LexiconEntry[] } {
  if (terms.length < 4) return { easy: terms, creative: terms };
  const sorted = [...terms].sort((a, b) => a.term.length + a.plain.length - (b.term.length + b.plain.length));
  const half = Math.ceil(sorted.length / 2);
  return { easy: sorted.slice(0, half), creative: sorted.slice(half) };
}

/**
 * Groups terms by category so a "confusable" round can draw several pairs
 * from the same family (e.g. multiple Ember Line variants), which are far
 * easier to mix up by plain meaning than two unrelated terms.
 */
function groupByCategory(terms: LexiconEntry[]): LexiconEntry[][] {
  const groups = new Map<string, LexiconEntry[]>();
  for (const term of terms) {
    const group = groups.get(term.category) ?? [];
    group.push(term);
    groups.set(term.category, group);
  }
  return Array.from(groups.values());
}

/**
 * Selects the pair pool for a Match round. Rounds 1-5 (index 0-4) draw from
 * the easy half, rounds 6-10 (index 5-9) from the creative half; round 11+
 * (index >= MATCH_CONFUSABLE_ROUND) prefers same-category clusters so the
 * board stays hard even once every term has already appeared once —
 * difficulty keeps climbing through term *selection*, not just less time.
 */
export function selectMatchRound(
  terms: LexiconEntry[],
  roundIndex: number,
  random: () => number = Math.random,
): LexiconEntry[] {
  const { easy, creative } = splitByDifficulty(terms);
  const pairCount = matchPairCountForRound(roundIndex, terms.length);

  if (roundIndex >= MATCH_CONFUSABLE_ROUND) {
    const groups = shuffle(groupByCategory(terms), random).filter((group) => group.length > 1);
    const confusable = groups.flatMap((group) => group).slice(0, pairCount);
    const pool = confusable.length >= pairCount ? confusable : terms;
    return shuffle(pool, random).slice(0, pairCount);
  }

  const pool = roundIndex < MATCH_CREATIVE_SPLIT_ROUND ? easy : creative;
  const source = pool.length >= pairCount ? pool : terms;
  return shuffle(source, random).slice(0, pairCount);
}

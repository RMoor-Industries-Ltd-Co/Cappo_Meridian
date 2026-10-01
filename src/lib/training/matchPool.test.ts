import { describe, expect, it } from "vitest";
import type { LexiconEntry } from "@/lib/lexicon-data";
import { selectMatchRound, splitByDifficulty } from "./matchPool";

function term(partial: Partial<LexiconEntry> & { term: string; plain: string; category: string }): LexiconEntry {
  return {
    meaning: `${partial.term} meaning`,
    use: "test",
    example: `${partial.term} example`,
    ...partial,
  };
}

// 10 short/concrete ("easy") terms and 10 longer/compound ("creative") terms,
// several sharing a category so the round-11+ confusable path has clusters
// to draw from. Large enough that every round's pair-count ladder value (up
// to 8) fits inside whichever half a round is supposed to draw from.
const EASY_TERMS: LexiconEntry[] = Array.from({ length: 10 }, (_, i) =>
  term({ term: `Term${i}`, plain: `Meaning${i}`, category: i % 2 === 0 ? "Ember Lines" : "Sanctum" }),
);
const CREATIVE_TERMS: LexiconEntry[] = Array.from({ length: 10 }, (_, i) =>
  term({
    term: `A Much Longer Compound Lexicon Phrase Number ${i}`,
    plain: `A correspondingly long plain-language meaning for phrase ${i}`,
    category: i % 2 === 0 ? "Atmos Chambers" : "Brand Language",
  }),
);
const POOL: LexiconEntry[] = [...EASY_TERMS, ...CREATIVE_TERMS];

describe("selectMatchRound", () => {
  it("every selected round has unique terms (no duplicate active cards)", () => {
    for (let round = 0; round < 15; round += 1) {
      const selected = selectMatchRound(POOL, round);
      const names = selected.map((t) => t.term);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("grows the pair count across early rounds and holds afterward", () => {
    const counts = Array.from({ length: 6 }, (_, round) => selectMatchRound(POOL, round).length);
    expect(counts).toEqual([5, 5, 6, 6, 7, 8]);
    expect(selectMatchRound(POOL, 20).length).toBe(8);
  });

  it("never selects more pairs than the pool can provide", () => {
    for (let round = 0; round < 15; round += 1) {
      expect(selectMatchRound(POOL, round).length).toBeLessThanOrEqual(POOL.length);
    }
  });

  it("draws from the easy half for rounds 1-5 and the creative half for rounds 6-10", () => {
    const { easy, creative } = splitByDifficulty(POOL);
    const easyNames = new Set(easy.map((t) => t.term));
    const creativeNames = new Set(creative.map((t) => t.term));

    const round0 = selectMatchRound(POOL, 0);
    expect(round0.every((t) => easyNames.has(t.term))).toBe(true);

    const round6 = selectMatchRound(POOL, 6);
    expect(round6.every((t) => creativeNames.has(t.term))).toBe(true);
  });

  it("keeps producing valid rounds past round 10 (endless play)", () => {
    for (const round of [10, 11, 20, 100]) {
      const selected = selectMatchRound(POOL, round);
      expect(selected.length).toBeGreaterThan(0);
      expect(selected.every((t) => POOL.some((p) => p.term === t.term))).toBe(true);
    }
  });
});

describe("splitByDifficulty", () => {
  it("falls back to the whole pool under 4 terms rather than crashing", () => {
    const tiny = POOL.slice(0, 2);
    const { easy, creative } = splitByDifficulty(tiny);
    expect(easy).toEqual(tiny);
    expect(creative).toEqual(tiny);
  });

  it("puts shorter term+plain pairs in the easy half", () => {
    const { easy, creative } = splitByDifficulty(POOL);
    expect(easy.every((t) => t.term.startsWith("Term"))).toBe(true);
    expect(creative.every((t) => t.term.startsWith("A Much Longer"))).toBe(true);
  });
});

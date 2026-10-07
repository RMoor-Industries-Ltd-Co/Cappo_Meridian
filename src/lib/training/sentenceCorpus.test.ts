import { describe, expect, it } from "vitest";
import type { LexiconEntry } from "@/lib/lexicon-data";
import {
  buildNotionSentences,
  buildSentencePool,
  buildWordBank,
  selectSentencesForScenario,
  blankOrder,
  maskSentence,
} from "./sentenceCorpus";

function term(overrides: Partial<LexiconEntry> & { term: string }): LexiconEntry {
  return {
    meaning: `${overrides.term} meaning`,
    use: `${overrides.term} use`,
    plain: `${overrides.term} plain`,
    example: `${overrides.term} example`,
    category: "Brand Language",
    ...overrides,
  };
}

const EMBER = term({
  term: "Ember Line",
  category: "Ember Lines",
  trainingSentences: ["When I say Ember Line, I'm referring to our incense expression."],
  professionalScenarios: ["lead time"],
  trainingAudiences: ["Supplier"],
  trainingDifficulty: 4,
  corpusStatus: "approved",
  wordBankDistractors: ["Aure"],
});
const AURE = term({ term: "Aure", category: "Brand Language" });
const SANCTUM = term({
  term: "Sanctum",
  category: "Sanctum",
  trainingSentences: ["Internally, we call this category a Sanctum, not a conventional ashtray."],
  professionalScenarios: [],
  trainingAudiences: ["Designer"],
  trainingDifficulty: null,
  corpusStatus: "seed",
});
const REVIEW_TERM = term({
  term: "Drift",
  category: "Brand Language",
  trainingSentences: ["The Drift settles after the Ember Line burns down."],
  corpusStatus: "review",
});
const PRIME_ANCHOR = term({ term: "Prime Anchor", category: "Prime Anchors" });

const ALL_TERMS = [EMBER, AURE, SANCTUM, REVIEW_TERM, PRIME_ANCHOR];

describe("buildNotionSentences", () => {
  it("builds one sentence per Training Sentences entry", () => {
    const result = buildNotionSentences([EMBER]);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("notion");
    expect(result[0].terms).toContain("Ember Line");
  });

  it("carries the term's normalized training audiences onto each sentence", () => {
    const [sentence] = buildNotionSentences([EMBER]);
    expect(sentence.audiences).toEqual(["Supplier"]);
  });

  it("auto-detects other Lexicon terms mentioned by name (compound)", () => {
    const [sentence] = buildNotionSentences([REVIEW_TERM, EMBER], { includeReview: true });
    expect(sentence.terms.sort()).toEqual(["Drift", "Ember Line"].sort());
    expect(sentence.kind).toBe("compound");
  });

  it("excludes Corpus Status: Review content by default", () => {
    expect(buildNotionSentences([REVIEW_TERM])).toHaveLength(0);
  });

  it("includes Review content only when includeReview is explicitly set", () => {
    expect(buildNotionSentences([REVIEW_TERM], { includeReview: true })).toHaveLength(1);
  });

  it("returns [] for a term with no Training Sentences", () => {
    expect(buildNotionSentences([AURE])).toHaveLength(0);
  });

  it("never marks Review content as approved even when included", () => {
    const [sentence] = buildNotionSentences([REVIEW_TERM], { includeReview: true });
    expect(sentence.approved).toBe(false);
  });
});

describe("buildSentencePool", () => {
  it("prefers Notion-backed sentences over curated/generated for the same term", () => {
    const pool = buildSentencePool([EMBER, AURE]);
    const emberEntries = pool.filter((s) => s.terms.includes("Ember Line") && s.source !== "generated");
    expect(emberEntries.some((s) => s.source === "notion")).toBe(true);
  });

  it("falls back to generated candidates for a term with no Notion or curated content", () => {
    const pool = buildSentencePool([term({ term: "Unseen Term" })]);
    expect(pool.every((s) => s.source === "generated")).toBe(true);
    expect(pool.length).toBeGreaterThan(0);
  });

  it("excludes Review content from the default pool", () => {
    const pool = buildSentencePool([REVIEW_TERM]);
    expect(pool.some((s) => s.corpusStatus === "review")).toBe(false);
  });
});

describe("selectSentencesForScenario", () => {
  const pool = buildSentencePool(ALL_TERMS);

  it("returns the full pool unfiltered for 'Mixed'", () => {
    expect(selectSentencesForScenario(pool, "Mixed")).toHaveLength(pool.length);
  });

  it("returns the full pool unfiltered when scenario is omitted", () => {
    expect(selectSentencesForScenario(pool, undefined)).toHaveLength(pool.length);
  });

  it("filters to sentences matching the audience or scenario tag", () => {
    const filtered = selectSentencesForScenario(pool, "Supplier");
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((s) => s.audiences.includes("Supplier") || s.scenarios.includes("Supplier"))).toBe(true);
  });

  it("falls back to the full pool when a scenario matches nothing, rather than returning empty", () => {
    const filtered = selectSentencesForScenario(pool, "Olfactory Specialist");
    expect(filtered.length).toBeGreaterThan(0);
  });
});

describe("blankOrder / maskSentence", () => {
  it("lists blank slot numbers in left-to-right reading order", () => {
    const sentence = {
      id: "x",
      terms: ["Ember Line", "Aure", "Drift"],
      text: "The Ember Line expresses the Aure during the burn, and the Drift remains afterward.",
      kind: "compound" as const,
      difficulty: 7,
      approved: true,
      source: "curated" as const,
      scenarios: [],
      audiences: [],
    };
    const masked = maskSentence(sentence);
    const order = blankOrder(sentence);
    // Every slot number appears, and the first one in `order` is the first one in the text.
    expect(order.sort()).toEqual([0, 1, 2]);
    const firstPlaceholder = masked.match(/\{\{(\d+)\}\}/);
    expect(Number(firstPlaceholder?.[1])).toBe(order[0]);
  });
});

describe("buildWordBank", () => {
  const random = () => 0.5; // deterministic shuffle

  it("never exceeds the 7-choice maximum", () => {
    const sentence = { terms: ["Ember Line", "Aure", "Drift", "Sanctum", "Prime Anchor"] };
    const bank = buildWordBank(sentence, ALL_TERMS, random);
    expect(bank.length).toBeLessThanOrEqual(7);
  });

  it("includes every required correct term", () => {
    const sentence = { terms: ["Ember Line", "Aure"] };
    const bank = buildWordBank(sentence, ALL_TERMS, random);
    expect(bank).toEqual(expect.arrayContaining(["Ember Line", "Aure"]));
  });

  it("contains no duplicate entries", () => {
    const sentence = { terms: ["Ember Line"], wordBankDistractorNames: ["Aure", "Aure"] };
    const bank = buildWordBank(sentence, ALL_TERMS, random);
    expect(new Set(bank).size).toBe(bank.length);
  });

  it("meets the 4-choice minimum when enough terms exist", () => {
    const sentence = { terms: ["Ember Line"] };
    const bank = buildWordBank(sentence, ALL_TERMS, random);
    expect(bank.length).toBeGreaterThanOrEqual(4);
  });

  it("prioritizes Notion-provided Word Bank Distractors over other terms", () => {
    const sentence = { terms: ["Ember Line"], wordBankDistractorNames: ["Aure"] };
    const bank = buildWordBank(sentence, ALL_TERMS, random);
    expect(bank).toContain("Aure");
  });
});

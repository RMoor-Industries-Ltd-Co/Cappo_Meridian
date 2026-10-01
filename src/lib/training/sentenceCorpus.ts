import type { LexiconEntry } from "@/lib/lexicon-data";
import { shuffle } from "./shuffle";
import { type TrainingAudience } from "./corpusText";
import { WORD_BANK_MIN, WORD_BANK_MAX } from "./config";

/**
 * Curated-usage-sentence contract for Lingo in Conversation.
 *
 * `terms` lists every Lexicon term the sentence exercises as a fill-in blank
 * — one entry for a single-blank sentence, several for a multi-term/compound
 * one. A sentence is canonical training material only once `approved` is
 * true; unapproved entries are machine-generated candidates kept around so
 * Conversation always has *something* to draw from while the curated corpus
 * is still being built out, and so a founder reviewing candidates has a
 * starting point rather than a blank page.
 *
 * `source` distinguishes three origins (directive "Conversation Corpus
 * Integration" §4/§13): `notion` (synced from the Lexicon database's new
 * training-corpus properties — the preferred, growing source), `curated`
 * (this file's small hand-written seed set, kept as a founder-reviewed
 * fallback), and `generated` (the deterministic fallback generator,
 * `approved: false`, never promoted to canonical automatically).
 */
export interface LexiconSentenceExample {
  id: string;
  terms: string[];
  text: string;
  kind: "short" | "conversation" | "sales" | "compound" | "real-world-replacement";
  difficulty: number; // 1-10
  approved: boolean;
  source: "notion" | "curated" | "generated";
  /** Corpus authoring status for Notion-sourced sentences (directive §12); absent for curated/generated. */
  corpusStatus?: "seed" | "review" | "approved";
  /** Professional-scenario tags this sentence trains for (directive §7/§17) — e.g. "Supplier", "lead time". */
  scenarios: string[];
  /** Normalized Training Audiences tags (directive §4), for scenario-filtered selection. */
  audiences: TrainingAudience[];
  /** Explicit distractor term names from Notion's "Word Bank Distractors" field, when present (directive §9). */
  wordBankDistractorNames?: string[];
}

/**
 * Seed curated corpus — hand-written, approved=true, grounded only in terms
 * and meanings already in `lexicon-data.ts` (no new terminology invented
 * here). This is a starting example set across the four prompt kinds, not a
 * claim of full coverage: expanding it is explicit deferred work (see the
 * Lexicon-Lingo directive's Required Return §13).
 */
export const CURATED_SENTENCES: LexiconSentenceExample[] = [
  {
    id: "atmos-chamber:short:1",
    terms: ["Atmos Chamber"],
    text: "Light the Atmos Chamber before your guests arrive.",
    kind: "short",
    difficulty: 1,
    approved: true,
    source: "curated",
    scenarios: [],
    audiences: ["General"],
  },
  {
    id: "ember-line:short:1",
    terms: ["Ember Line"],
    text: "Place the Ember Line on the stone tray and let it burn.",
    kind: "short",
    difficulty: 1,
    approved: true,
    source: "curated",
    scenarios: [],
    audiences: ["General"],
  },
  {
    id: "aure:conversation:1",
    terms: ["Aure"],
    text: "Give it a minute — the Aure takes a moment to rise once the Ember Line is lit.",
    kind: "conversation",
    difficulty: 3,
    approved: true,
    source: "curated",
    scenarios: [],
    audiences: ["General"],
  },
  {
    id: "sanctum:sales:1",
    terms: ["Sanctum"],
    text: "This piece isn't an ashtray — it's a Sanctum, built for a ritual that deserves better than disposal.",
    kind: "sales",
    difficulty: 4,
    approved: true,
    source: "curated",
    scenarios: ["pricing"],
    audiences: ["Customer"],
  },
  {
    id: "prime-anchor:sales:1",
    terms: ["Prime Anchor"],
    text: "A Prime Anchor holds the Note in the room long after the flame is gone — no outlet required.",
    kind: "sales",
    difficulty: 4,
    approved: true,
    source: "curated",
    scenarios: ["product characteristics"],
    audiences: ["Customer"],
  },
  {
    id: "appointments:real-world-replacement:1",
    terms: ["HVN Appointments"],
    text: "The curated objects on this shelf are HVN Appointments, not HVN originals.",
    kind: "real-world-replacement",
    difficulty: 3,
    approved: true,
    source: "curated",
    scenarios: ["assortment"],
    audiences: ["Designer"],
  },
  {
    id: "drift-ember-line:compound:1",
    terms: ["Ember Line", "Drift", "Aure"],
    text: "As the Ember Line burns down, the Aure thins and only the Drift remains on the tray.",
    kind: "compound",
    difficulty: 7,
    approved: true,
    source: "curated",
    scenarios: ["burn behavior"],
    audiences: ["Supplier", "Manufacturer"],
  },
  {
    id: "havenry-appointments:compound:1",
    terms: ["Havenry", "HVN Appointments"],
    text: "Step into the Havenry and you'll find HVN originals shown alongside selected HVN Appointments.",
    kind: "compound",
    difficulty: 6,
    approved: true,
    source: "curated",
    scenarios: ["spatial composition"],
    audiences: ["Designer", "Wholesaler"],
  },
];

function stableHash(value: string): number {
  return Array.from(value).reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function relatedTerms(target: LexiconEntry, terms: LexiconEntry[]): LexiconEntry[] {
  const candidates = terms.filter((term) => term.term !== target.term);
  return [...candidates].sort((a, b) => {
    const aSame = a.category === target.category ? 0 : 1;
    const bSame = b.category === target.category ? 0 : 1;
    return aSame - bSame || stableHash(`${target.term}:${a.term}`) - stableHash(`${target.term}:${b.term}`);
  });
}

export function evaluateSentenceDifficulty(text: string, terms: string[], target: LexiconEntry): number {
  const words = text.trim().split(/\s+/).length;
  const termWords = terms.reduce((sum, term) => sum + term.split(/\s+/).length, 0);
  const categoryWeight = target.category === "Brand Language" ? 2 : 1;
  const raw = 1 + terms.length * 1.6 + termWords * 0.25 + Math.max(0, words - 10) * 0.08 + categoryWeight;
  return Math.max(1, Math.min(10, Math.round(raw)));
}

/**
 * Generates unapproved candidate sentences so Conversation has content for
 * any selected term the curated corpus doesn't cover yet. Deterministic
 * aside from presentation order — the same term always yields the same
 * candidate text, so a founder reviewing/approving candidates sees stable
 * output to judge.
 */
export function buildGeneratedCandidates(terms: LexiconEntry[]): LexiconSentenceExample[] {
  return terms.flatMap((target) => {
    const related = relatedTerms(target, terms);
    const first = related[0] ?? target;
    const second = related[1] ?? first;
    const drafts: Array<{ text: string; terms: string[]; kind: LexiconSentenceExample["kind"] }> = [
      {
        text: target.example.includes(target.term) ? target.example : `${target.term}: ${target.example}`,
        terms: [target.term],
        kind: "short",
      },
      {
        text: `${target.term} is used when the team means ${target.plain.replace(/\.$/, "").toLowerCase()}.`,
        terms: [target.term],
        kind: "conversation",
      },
      {
        text: `In the room, ${target.term} appears beside ${first.term} and ${second.term} to shape the composition.`,
        terms: [target.term, first.term, second.term],
        kind: "compound",
      },
    ];
    return drafts.map((draft, index) => ({
      id: `${target.term}:generated:${index}`,
      terms: draft.terms,
      text: draft.text,
      kind: draft.kind,
      difficulty: evaluateSentenceDifficulty(draft.text, draft.terms, target),
      approved: false as const,
      source: "generated" as const,
      scenarios: [],
      audiences: [],
    }));
  });
}

const KIND_BY_AUDIENCE: Partial<Record<TrainingAudience, LexiconSentenceExample["kind"]>> = {
  Supplier: "sales",
  Wholesaler: "sales",
  Designer: "real-world-replacement",
  Manufacturer: "sales",
  "Olfactory Specialist": "conversation",
  Customer: "sales",
  General: "conversation",
};

function inferKind(
  terms: string[],
  audiences: TrainingAudience[],
): LexiconSentenceExample["kind"] {
  if (terms.length > 1) return "compound";
  for (const audience of audiences) {
    const kind = KIND_BY_AUDIENCE[audience];
    if (kind) return kind;
  }
  return "conversation";
}

/**
 * Builds training sentences from each term's Notion-synced training-corpus
 * fields (directive "Conversation Corpus Integration" §4-5, §13-14). Each
 * `Training Sentences` entry on a term becomes one exercise. Other Lexicon
 * terms mentioned by name in the sentence text are automatically folded into
 * `terms` (making it a multi-blank/"compound" exercise) so a sentence like
 * "We call this category a Sanctum..." need not be re-authored once Sanctum
 * is already the target term — the directive explicitly asks that these
 * become training input, not hard-coded UI copy, so no sentence text is
 * special-cased here.
 */
export function buildNotionSentences(
  terms: LexiconEntry[],
  options: { includeReview?: boolean } = {},
): LexiconSentenceExample[] {
  const includeReview = options.includeReview ?? false;
  const allNames = terms.map((t) => t.term).sort((a, b) => b.length - a.length);

  return terms.flatMap((target) => {
    const sentences = target.trainingSentences ?? [];
    if (sentences.length === 0) return [];
    const corpusStatus = target.corpusStatus ?? "seed";
    if (corpusStatus === "review" && !includeReview) return [];

    const audiences = (target.trainingAudiences ?? []) as TrainingAudience[];
    const scenarios = target.professionalScenarios ?? [];
    const distractorNames = target.wordBankDistractors ?? [];

    return sentences.map((text, index) => {
      const mentioned = allNames.filter((name) => {
        const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        return re.test(text);
      });
      const sentenceTerms = Array.from(new Set([target.term, ...mentioned]));
      return {
        id: `${target.term}:notion:${index}`,
        terms: sentenceTerms,
        text,
        kind: inferKind(sentenceTerms, audiences),
        difficulty: target.trainingDifficulty ?? evaluateSentenceDifficulty(text, sentenceTerms, target),
        approved: corpusStatus !== "review",
        source: "notion" as const,
        corpusStatus,
        scenarios,
        audiences,
        wordBankDistractorNames: distractorNames.length > 0 ? distractorNames : undefined,
      } satisfies LexiconSentenceExample;
    });
  });
}

/**
 * The pool Conversation actually draws from, in preference order: Notion-synced
 * training sentences (the growing, Founder-authored corpus) first, then the
 * small hand-written curated seed set, then generated fallback candidates for
 * any term still uncovered by either. `includeReview` lets a debug/dev path
 * preview `Corpus Status: Review` content (directive §12) — off by default so
 * Review material never reaches normal play.
 */
export function buildSentencePool(
  terms: LexiconEntry[],
  options: { includeReview?: boolean } = {},
): LexiconSentenceExample[] {
  const names = new Set(terms.map((t) => t.term));
  const notion = buildNotionSentences(terms, options);
  const curated = CURATED_SENTENCES.filter((s) => s.terms.every((t) => names.has(t)));
  const covered = new Set([...notion, ...curated].flatMap((s) => s.terms));
  const stillNeeded = terms.filter((t) => !covered.has(t.term));
  const generated = buildGeneratedCandidates(stillNeeded);
  return [...notion, ...curated, ...generated];
}

/**
 * Narrows a pool to a professional scenario/audience (directive §7, §17).
 * "Mixed" (or an unrecognized/omitted scenario) returns the pool unfiltered.
 * Never returns an empty pool when the unfiltered pool has content — falls
 * back to the full pool rather than leaving a learner with nothing to play.
 */
export function selectSentencesForScenario(
  pool: LexiconSentenceExample[],
  scenario: string | undefined | null,
): LexiconSentenceExample[] {
  if (!scenario || scenario.toLowerCase() === "mixed") return pool;
  const needle = scenario.toLowerCase();
  const filtered = pool.filter(
    (s) =>
      s.audiences.some((a) => a.toLowerCase() === needle) ||
      s.scenarios.some((sc) => sc.toLowerCase() === needle),
  );
  return filtered.length > 0 ? filtered : pool;
}

/** Masks every term a sentence exercises, longest-first so overlapping names don't double-replace. */
export function maskSentence(sentence: LexiconSentenceExample): string {
  return [...sentence.terms]
    .sort((a, b) => b.length - a.length)
    .reduce((text, term, index) => text.replace(term, `{{${index}}}`), sentence.text);
}

/**
 * Returns the blank-slot numbers (as assigned by `maskSentence`) in the order
 * they actually appear when reading the masked sentence left-to-right — not
 * the longest-term-first order they were assigned in. The tap-to-place UI
 * uses this so "fill the next blank" always means the next one visually, not
 * an internal sort order a learner has no way to see (directive §10: "the
 * learner taps terms in sequence").
 */
export function blankOrder(sentence: LexiconSentenceExample): number[] {
  const masked = maskSentence(sentence);
  const matches = masked.match(/\{\{\d+\}\}/g) ?? [];
  return matches.map((m) => Number(m.slice(2, -2)));
}

/** Picks `count` sentences at or near the requested difficulty tier, preferring approved content. */
export function selectSentencesForDifficulty(
  pool: LexiconSentenceExample[],
  difficultyTier: number,
  count: number,
): LexiconSentenceExample[] {
  const byCloseness = [...pool].sort((a, b) => {
    const approvedDelta = Number(b.approved) - Number(a.approved);
    if (approvedDelta !== 0) return approvedDelta;
    return Math.abs(a.difficulty - difficultyTier) - Math.abs(b.difficulty - difficultyTier);
  });
  return shuffle(byCloseness.slice(0, Math.max(count * 3, count))).slice(0, count);
}

/**
 * Builds the tap-to-place word bank for one sentence: every correct term plus
 * distractors, total clamped to [{@link WORD_BANK_MIN}, {@link WORD_BANK_MAX}]
 * (directive §9) unless the sentence itself requires more blanks than
 * {@link WORD_BANK_MAX} allows, in which case every required blank is still
 * included (a learner must be able to complete the sentence). Distractor
 * priority: (1) the sentence's own `Word Bank Distractors` from Notion, (2)
 * other terms sharing a Lexicon category with a correct term, (3) any
 * remaining term — each tier shuffled before being drawn from, so results
 * aren't alphabetically or insertion-order biased. Never includes a
 * duplicate label and never draws a distractor that is itself one of the
 * sentence's correct terms.
 */
export function buildWordBank(
  sentence: Pick<LexiconSentenceExample, "terms" | "wordBankDistractorNames">,
  allTerms: LexiconEntry[],
  random: () => number = Math.random,
): string[] {
  const correct = Array.from(new Set(sentence.terms));
  const blanks = correct.length;
  const targetTotal = Math.min(WORD_BANK_MAX, Math.max(WORD_BANK_MIN, blanks + 2));
  const distractorsNeeded = Math.max(0, targetTotal - blanks);

  const correctSet = new Set(correct);
  const byName = new Map(allTerms.map((t) => [t.term, t]));
  const categoriesOfCorrect = new Set(
    correct.map((name) => byName.get(name)?.category).filter((c): c is string => Boolean(c)),
  );
  const pool = allTerms.filter((t) => !correctSet.has(t.term));

  const fromNotion = (sentence.wordBankDistractorNames ?? []).filter(
    (name) => !correctSet.has(name) && pool.some((t) => t.term === name),
  );
  const remaining = pool.filter((t) => !fromNotion.includes(t.term));
  const sameCategory = shuffle(
    remaining.filter((t) => categoriesOfCorrect.has(t.category)),
    random,
  ).map((t) => t.term);
  const rest = shuffle(
    remaining.filter((t) => !categoriesOfCorrect.has(t.category)),
    random,
  ).map((t) => t.term);

  const distractors: string[] = [];
  for (const name of [...fromNotion, ...sameCategory, ...rest]) {
    if (distractors.length >= distractorsNeeded) break;
    if (!distractors.includes(name)) distractors.push(name);
  }

  return shuffle([...correct, ...distractors], random);
}

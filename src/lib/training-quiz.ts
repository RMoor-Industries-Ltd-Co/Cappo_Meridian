/**
 * Training quiz engine — pure (no React, no I/O) so the question generators and the
 * answer grader can be exercised without a browser. `TrainingQuiz.tsx` renders it;
 * `training-scorecard.ts` reuses the mode labels for the report email.
 *
 * Terminology is always sourced from the `LexiconEntry[]` the page passes in (the
 * Official Lexicon Database copy, with the static list only as the empty-DB fallback).
 * Nothing in here keeps a lexicon of its own.
 */
import type { LexiconEntry } from "@/lib/lexicon-data";
import { USAGE_TF } from "@/lib/quiz-usage";

// ─── Modes ───────────────────────────────────────────────────────────────────

export type SessionMode = "match" | "blank" | "quiz" | "master";

/** Display order = progression order. */
export const MODE_ORDER: SessionMode[] = ["match", "blank", "quiz", "master"];

export interface ModeMeta {
  label: string;
  /** What the mode trains — the progression the selector and results communicate. */
  tier: string;
  sub: string;
  beginLabel: string;
  lives: number;
}

export const MODES: Record<SessionMode, ModeMeta> = {
  match: {
    label: "Word Match",
    tier: "Recognition",
    sub: "Pair each AMG term with its plain meaning.",
    beginLabel: "Begin Word Match",
    lives: 3,
  },
  blank: {
    label: "Fill in the Blank",
    tier: "Recall",
    sub: "Read the clue and type the missing AMG term.",
    beginLabel: "Begin Fill in the Blank",
    lives: 3,
  },
  quiz: {
    label: "Question Round",
    tier: "Comprehension",
    sub: "Answer definitions, usage checks, and true/false.",
    beginLabel: "Begin Session",
    lives: 3,
  },
  master: {
    label: "Master Quiz",
    tier: "Mastery",
    sub: "The final exam: matching, recall, multiple choice, and true/false in one run.",
    beginLabel: "Begin Master Quiz",
    lives: 5,
  },
};

/** Human label for a mode key; unknown keys (older clients) pass through unchanged. */
export function modeLabel(mode: string): string {
  return mode in MODES ? MODES[mode as SessionMode].label : mode;
}

export const BLANK_ROUND_SIZE = 10;
export const QUIZ_ROUND_SIZE = 20;
export const MASTER_ROUND_SIZE = 30;
export const MATCH_ROUND_SIZE = 6;
const MATCH_BLOCK_SIZE = 3;
const MASTER_MATCH_BLOCKS = 3;

/** Share of correct answers the Master Quiz requires (hearts must also remain). */
export const MASTER_PASS_PERCENT = 80;

export const XP = { choice: 10, tf: 10, blank: 15, match: 15 } as const;

export function evaluateResult(input: {
  mode: SessionMode;
  score: number;
  total: number;
  lives: number;
}): { percent: number; passed: boolean } {
  const percent = input.total > 0 ? Math.round((input.score / input.total) * 100) : 0;
  const passed =
    input.mode === "master" ? input.lives > 0 && percent >= MASTER_PASS_PERCENT : input.lives > 0;
  return { percent, passed };
}

// ─── Question types ──────────────────────────────────────────────────────────

/**
 * Every question carries an `explanation` shown after answering (the teaching moment).
 * Choice/tf answers are plain strings; blank is typed and graded by `gradeBlank`;
 * match is a small block of pairs that is played to completion.
 */
export interface ChoiceQuestion {
  kind: "choice";
  term: string;
  promptLabel: string;
  prompt: string;
  correct: string;
  options: string[];
  explanation: string;
}
export interface TrueFalseQuestion {
  kind: "tf";
  terms: string[];
  statement: string;
  correct: "True" | "False";
  explanation: string;
}
export interface BlankQuestion {
  kind: "blank";
  term: string;
  promptLabel: string;
  /** A sentence or definition with the term replaced by a blank. */
  prompt: string;
  /** Shape hint only (word/letter count) — never any of the letters. */
  hint: string;
  /**
   * Other lexicon terms whose clue is word-for-word identical once masked (e.g. two terms
   * sharing one example sentence) — equally correct answers to this prompt. Derived from
   * the data, not a stored alias.
   */
  alsoAccept: string[];
  explanation: string;
}
export interface MatchPair {
  term: string;
  plain: string;
  meaning: string;
}
export interface MatchQuestion {
  kind: "match";
  pairs: MatchPair[];
  explanation: string;
}
export type Question = ChoiceQuestion | TrueFalseQuestion | BlankQuestion | MatchQuestion;

/** The progression tier a question exercises (shown as a chip in the Master Quiz). */
export function questionTier(q: Question): string {
  switch (q.kind) {
    case "match":
      return MODES.match.tier;
    case "blank":
      return MODES.blank.tier;
    default:
      return MODES.quiz.tier;
  }
}

/** Lexicon terms a missed question should be reviewed under. */
export function questionTerms(q: Question): string[] {
  switch (q.kind) {
    case "choice":
    case "blank":
      return [q.term];
    case "tf":
      return q.terms;
    case "match":
      return q.pairs.map((p) => p.term);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const rnd = () => Math.random() - 0.5;
const lc = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

// ─── Fill in the Blank: masking + grading ────────────────────────────────────

const BLANK = "_____";

/** Singular/plural and "The …" spellings of a term, for masking and grading. */
function termVariants(term: string): string[] {
  const base = term.trim();
  const out = new Set<string>([base]);
  const bare = base.replace(/^the\s+/i, "");
  out.add(bare);
  out.add(`The ${bare}`);
  for (const v of [...out]) {
    out.add(/s$/i.test(v) ? v.slice(0, -1) : `${v}s`);
  }
  return [...out].filter((v) => v.length > 1);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Replace every spelling of `term` in `text` with a blank. */
export function maskTerm(text: string, term: string): { text: string; masked: boolean } {
  const alternation = termVariants(term)
    .sort((a, b) => b.length - a.length)
    .map((v) => escapeRe(v).replace(/\s+/g, "\\s+"))
    .join("|");
  const re = new RegExp(`(?<![A-Za-z0-9])(?:${alternation})(?![A-Za-z0-9])`, "gi");
  let masked = false;
  const out = text.replace(re, () => {
    masked = true;
    return BLANK;
  });
  return { text: out, masked };
}

/** Case/space/quote-insensitive form used for the "exact" comparison. */
export function normalizeAnswer(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .replace(/^[\s"'.,;:!?()-]+|[\s"'.,;:!?()-]+$/g, "");
}

/** Looser key: drops a leading "the", punctuation/spacing, and a trailing plural "s". */
function looseKey(input: string): string {
  const key = normalizeAnswer(input)
    .replace(/^the /, "")
    .replace(/[^a-z0-9]/g, "");
  return key.length > 3 ? key.replace(/s$/, "") : key;
}

export type BlankGrade = "exact" | "variant" | "wrong";

/**
 * Exact (case-insensitive, trimmed) match first; then spelling variants of the same term
 * (singular/plural, a missing "The", hyphen/space differences). The lexicon data model
 * carries no aliases, so none are invented here; `alsoAccept` only lists terms whose clue is
 * identical (see `BlankQuestion.alsoAccept`).
 */
export function gradeBlank(input: string, term: string, alsoAccept: string[] = []): BlankGrade {
  if (!input.trim()) return "wrong";
  const accepted = [term, ...alsoAccept];
  if (accepted.some((t) => normalizeAnswer(input) === normalizeAnswer(t))) return "exact";
  return accepted.some((t) => looseKey(input) === looseKey(t)) ? "variant" : "wrong";
}

function shapeHint(term: string): string {
  const words = term.trim().split(/\s+/).length;
  const letters = term.replace(/[^A-Za-z0-9]/g, "").length;
  return `${words} ${words === 1 ? "word" : "words"} · ${letters} letters`;
}

/** The masked clue (and its label) for a term, or null when the entry has no text to build one from. */
function blankClue(term: LexiconEntry): { label: string; prompt: string } | null {
  const sentence = term.example ? maskTerm(term.example, term.term) : null;
  if (sentence?.masked) {
    return { label: "Complete the sentence — type the missing AMG term", prompt: sentence.text };
  }
  const definition = (term.meaning || term.plain).trim();
  if (!definition) return null;
  return {
    label: "Type the AMG term that fits this definition",
    prompt: maskTerm(definition, term.term).text,
  };
}

/**
 * One blank question for a term, or null when the entry has no text to build a clue from.
 * Pass the selected pool as `terms` so equivalent terms (identical clue) are also accepted.
 */
export function blankFromTerm(term: LexiconEntry, terms: LexiconEntry[] = []): BlankQuestion | null {
  const clue = blankClue(term);
  if (!clue) return null;
  const alsoAccept = terms
    .filter((o) => o.term !== term.term && blankClue(o)?.prompt === clue.prompt)
    .map((o) => o.term);
  return {
    kind: "blank",
    term: term.term,
    promptLabel: clue.label,
    prompt: clue.prompt,
    hint: shapeHint(term.term),
    alsoAccept,
    explanation: `${term.term}${term.meaning ? ` — ${term.meaning}` : ""}${term.use ? ` (${term.use})` : ""}`,
  };
}

/** Blank questions for a shuffled pool, skipping a clue that an earlier question already uses. */
function blankPool(terms: LexiconEntry[], source: LexiconEntry[] = terms): BlankQuestion[] {
  const seen = new Set<string>();
  const out: BlankQuestion[] = [];
  for (const t of [...source].sort(rnd)) {
    const q = blankFromTerm(t, terms);
    if (!q || seen.has(q.prompt)) continue;
    seen.add(q.prompt);
    out.push(q);
  }
  return out;
}

export function generateBlankQuestions(terms: LexiconEntry[], count = BLANK_ROUND_SIZE): Question[] {
  return blankPool(terms).slice(0, count);
}

// ─── Choice / true-false generators ──────────────────────────────────────────

export function choiceFromTerm(term: LexiconEntry, terms: LexiconEntry[]): ChoiceQuestion {
  const mode: "a" | "b" = Math.random() > 0.5 ? "a" : "b";
  const correct = mode === "a" ? term.plain : term.term;
  // Distractors must differ in meaning from the term and from each other: terms can share one
  // plain meaning, which would otherwise yield two correct options or identical option strings.
  const seenPlain = new Set<string>([term.plain]);
  const wrong: string[] = [];
  for (const t of [...terms].sort(rnd)) {
    if (t.term === term.term || seenPlain.has(t.plain)) continue;
    seenPlain.add(t.plain);
    wrong.push(mode === "a" ? t.plain : t.term);
    if (wrong.length === 3) break;
  }
  const options = [...wrong, correct].sort(rnd);
  return {
    kind: "choice",
    term: term.term,
    promptLabel: mode === "a" ? "What does this term mean?" : "Name this term",
    prompt: mode === "a" ? term.term : term.plain,
    correct,
    options,
    explanation: `${term.term} — ${term.meaning}${term.use ? ` (${term.use})` : ""}`,
  };
}

/** Auto true/false: a term paired with its own meaning (true) or another's (false). */
export function meaningTF(term: LexiconEntry, terms: LexiconEntry[]): TrueFalseQuestion {
  if (Math.random() > 0.5) {
    return {
      kind: "tf",
      terms: [term.term],
      statement: `Is it true that “${term.term}” means ${lc(term.plain)}?`,
      correct: "True",
      explanation: `Correct — ${term.term} means ${lc(term.plain)}. ${term.meaning}`,
    };
  }
  const other =
    terms.filter((t) => t.term !== term.term && t.plain !== term.plain).sort(rnd)[0] ?? term;
  return {
    kind: "tf",
    terms: [term.term, other.term],
    statement: `Is it true that “${term.term}” means ${lc(other.plain)}?`,
    correct: "False",
    explanation: `Not quite — that describes ${other.term}. ${term.term} means ${lc(term.plain)}: ${term.meaning}`,
  };
}

/** Curated usage true/false (brand claims, commonly-confused pairs) eligible for the pool. */
function curatedUsageTF(terms: LexiconEntry[]): TrueFalseQuestion[] {
  const poolNames = new Set(terms.map((t) => t.term));
  return USAGE_TF.filter((q) => q.terms.length === 0 || q.terms.some((n) => poolNames.has(n)))
    .sort(rnd)
    .map((q) => ({
      kind: "tf" as const,
      terms: q.terms,
      statement: q.statement,
      correct: q.answer,
      explanation: q.explanation,
    }));
}

export function generateQuestions(
  terms: LexiconEntry[],
  count = QUIZ_ROUND_SIZE,
  advanced = true,
): Question[] {
  const choiceQs = [...terms].sort(rnd).map((t) => choiceFromTerm(t, terms));
  if (!advanced) return choiceQs.slice(0, count);

  const curatedTF = curatedUsageTF(terms);
  const autoTF = [...terms].sort(rnd).map((t) => meaningTF(t, terms));

  // Aim for roughly half true/false (curated usage first, then auto-generated),
  // the rest multiple-choice, then shuffle the blend.
  const tfTarget = Math.ceil(count / 2);
  const tf = [...curatedTF, ...autoTF].slice(0, tfTarget);
  const choice = choiceQs.slice(0, Math.max(0, count - tf.length));
  return [...tf, ...choice].sort(rnd).slice(0, count);
}

// ─── Word Match + Master Quiz ────────────────────────────────────────────────

export function generateMatchPairs(terms: LexiconEntry[], count = MATCH_ROUND_SIZE): MatchPair[] {
  // The match UI keys on the plain meaning, so two terms sharing one meaning in the same round
  // could never both be matched — keep meanings distinct.
  const seen = new Set<string>();
  const pairs: MatchPair[] = [];
  for (const term of [...terms].sort(rnd)) {
    if (pairs.length >= count) break;
    if (seen.has(term.plain)) continue;
    seen.add(term.plain);
    pairs.push({ term: term.term, plain: term.plain, meaning: term.meaning });
  }
  return pairs;
}

/**
 * Master Quiz match blocks: 2–3 pairs per block with distinct plain meanings (the match UI
 * is keyed on the meaning, so a repeated meaning would be ambiguous).
 */
function generateMatchBlocks(terms: LexiconEntry[]): MatchQuestion[] {
  const blockSize = Math.min(MATCH_BLOCK_SIZE, terms.length);
  if (blockSize < 2) return [];
  const usable = [...terms].sort(rnd).filter((t) => t.plain.trim());
  const blocks: MatchQuestion[] = [];
  const used = new Set<string>();
  while (blocks.length < MASTER_MATCH_BLOCKS) {
    const pairs: MatchPair[] = [];
    const plains = new Set<string>();
    for (const t of usable) {
      if (used.has(t.term) || plains.has(t.plain)) continue;
      plains.add(t.plain);
      pairs.push({ term: t.term, plain: t.plain, meaning: t.meaning });
      if (pairs.length === blockSize) break;
    }
    if (pairs.length < 2) break;
    pairs.forEach((p) => used.add(p.term));
    blocks.push({
      kind: "match",
      pairs,
      explanation: pairs.map((p) => `${p.term} — ${p.plain}`).join(" · "),
    });
  }
  return blocks;
}

/**
 * The final exam: match blocks (recognition), typed blanks (recall), multiple choice and
 * true/false incl. curated usage checks (comprehension), shuffled together. Fewer than
 * `size` only when the selected pool can't supply that many.
 */
export function generateMasterQuestions(terms: LexiconEntry[], size = MASTER_ROUND_SIZE): Question[] {
  const matchBlocks = generateMatchBlocks(terms);
  const matched = new Set(matchBlocks.flatMap((b) => b.pairs.map((p) => p.term)));

  const slots = Math.max(0, size - matchBlocks.length);
  const blankSlots = Math.round(slots * 0.35);
  const tfSlots = Math.round(slots * 0.3);
  const choiceSlots = slots - blankSlots - tfSlots;

  // Prefer terms the match blocks haven't already covered, when the pool is big enough.
  const fresh = terms.filter((t) => !matched.has(t.term));
  const source = fresh.length >= blankSlots + choiceSlots ? fresh : terms;

  const blanks = blankPool(terms, source);
  const choices = [...source].sort(rnd).map((t) => choiceFromTerm(t, terms));
  const tfs: Question[] = [
    ...curatedUsageTF(terms),
    ...[...source].sort(rnd).map((t) => meaningTF(t, terms)),
  ];

  const picked: Question[] = [
    ...blanks.splice(0, blankSlots),
    ...tfs.splice(0, tfSlots),
    ...choices.splice(0, choiceSlots),
  ];
  // A bucket that ran dry is topped up from whatever the others have left.
  const leftovers = [...blanks, ...tfs, ...choices].sort(rnd);
  while (picked.length < slots && leftovers.length) picked.push(leftovers.shift()!);

  return [...matchBlocks, ...picked].sort(rnd).slice(0, size);
}

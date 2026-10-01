import type { LexiconEntry } from "@/lib/lexicon-data";
import { shuffle } from "./shuffle";

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
 */
export interface LexiconSentenceExample {
  id: string;
  terms: string[];
  text: string;
  kind: "short" | "conversation" | "sales" | "compound" | "real-world-replacement";
  difficulty: number; // 1-10
  approved: boolean;
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
  },
  {
    id: "ember-line:short:1",
    terms: ["Ember Line"],
    text: "Place the Ember Line on the stone tray and let it burn.",
    kind: "short",
    difficulty: 1,
    approved: true,
  },
  {
    id: "aure:conversation:1",
    terms: ["Aure"],
    text: "Give it a minute — the Aure takes a moment to rise once the Ember Line is lit.",
    kind: "conversation",
    difficulty: 3,
    approved: true,
  },
  {
    id: "sanctum:sales:1",
    terms: ["Sanctum"],
    text: "This piece isn't an ashtray — it's a Sanctum, built for a ritual that deserves better than disposal.",
    kind: "sales",
    difficulty: 4,
    approved: true,
  },
  {
    id: "prime-anchor:sales:1",
    terms: ["Prime Anchor"],
    text: "A Prime Anchor holds the Note in the room long after the flame is gone — no outlet required.",
    kind: "sales",
    difficulty: 4,
    approved: true,
  },
  {
    id: "appointments:real-world-replacement:1",
    terms: ["HVN Appointments"],
    text: "The curated objects on this shelf are HVN Appointments, not HVN originals.",
    kind: "real-world-replacement",
    difficulty: 3,
    approved: true,
  },
  {
    id: "drift-ember-line:compound:1",
    terms: ["Ember Line", "Drift", "Aure"],
    text: "As the Ember Line burns down, the Aure thins and only the Drift remains on the tray.",
    kind: "compound",
    difficulty: 7,
    approved: true,
  },
  {
    id: "havenry-appointments:compound:1",
    terms: ["Havenry", "HVN Appointments"],
    text: "Step into the Havenry and you'll find HVN originals shown alongside selected HVN Appointments.",
    kind: "compound",
    difficulty: 6,
    approved: true,
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
    }));
  });
}

/**
 * The pool Conversation actually draws from: curated (approved) sentences
 * for the selected terms, topped up with generated candidates for any term
 * the curated set doesn't cover yet. Curated content is always preferred.
 */
export function buildSentencePool(terms: LexiconEntry[]): LexiconSentenceExample[] {
  const names = new Set(terms.map((t) => t.term));
  const curated = CURATED_SENTENCES.filter((s) => s.terms.every((t) => names.has(t)));
  const coveredTargets = new Set(curated.flatMap((s) => s.terms));
  const stillNeeded = terms.filter((t) => !coveredTargets.has(t.term));
  const generated = buildGeneratedCandidates(stillNeeded);
  return [...curated, ...generated];
}

/** Masks every term a sentence exercises, longest-first so overlapping names don't double-replace. */
export function maskSentence(sentence: LexiconSentenceExample): string {
  return [...sentence.terms]
    .sort((a, b) => b.length - a.length)
    .reduce((text, term, index) => text.replace(term, `{{${index}}}`), sentence.text);
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

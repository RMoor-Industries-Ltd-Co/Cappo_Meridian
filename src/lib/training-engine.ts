import type { LexiconEntry } from "@/lib/lexicon-data";

export const SENTENCE_ROUND_BASE_SECONDS = [300, 240, 180, 120, 0] as const;
export const MASTER_SESSION_SECONDS = 300;
export const MASTER_MATCH_BONUS_PER_PAIR = 10;
export const MASTER_MATCH_BONUS_CAP = 60;

export type TrainingMode = "Quick Quiz" | "Term Match" | "Sentence Completion" | "Master Quiz";

export interface TrainingSentence {
  id: string;
  target: string;
  text: string;
  answers: string[];
  kind: "direct" | "contextual";
  difficulty: number;
}

const stableHash = (value: string) =>
  Array.from(value).reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);

export function shuffle<T>(values: T[], random = Math.random): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function relatedTerms(target: LexiconEntry, terms: LexiconEntry[]): LexiconEntry[] {
  const candidates = terms.filter((term) => term.term !== target.term);
  return [...candidates].sort((a, b) => {
    const aSame = a.category === target.category ? 0 : 1;
    const bSame = b.category === target.category ? 0 : 1;
    return aSame - bSame || stableHash(`${target.term}:${a.term}`) - stableHash(`${target.term}:${b.term}`);
  });
}

export function evaluateSentenceDifficulty(
  text: string,
  answers: string[],
  target: LexiconEntry,
): number {
  const words = text.trim().split(/\s+/).length;
  const answerWords = answers.reduce((sum, answer) => sum + answer.split(/\s+/).length, 0);
  const categoryWeight = target.category === "Brand Language" ? 2 : 1;
  const raw = 1 + answers.length * 1.6 + answerWords * 0.25 + Math.max(0, words - 10) * 0.08 + categoryWeight;
  return Math.max(1, Math.min(10, Math.round(raw)));
}

/**
 * Builds exactly five sentences per controlled Lexicon term: two direct-use
 * examples and three contextual examples that deliberately combine vocabulary.
 * The bank is deterministic; only presentation order is randomized.
 */
export function buildSentenceBank(terms: LexiconEntry[]): TrainingSentence[] {
  return terms.flatMap((target) => {
    const related = relatedTerms(target, terms);
    const first = related[0] ?? target;
    const second = related[1] ?? first;
    const third = related[2] ?? second;
    const definitions: Array<Omit<TrainingSentence, "difficulty">> = [
      {
        id: `${target.term}:direct:1`, target: target.term, text: target.example,
        answers: [target.term], kind: "direct",
      },
      {
        id: `${target.term}:direct:2`, target: target.term,
        text: `${target.term} is used when the team means ${target.plain.replace(/\.$/, "").toLowerCase()}.`,
        answers: [target.term], kind: "direct",
      },
      {
        id: `${target.term}:context:1`, target: target.term,
        text: `${target.term} appears beside ${first.term} to shape the room with a deliberate Note.`,
        answers: [target.term, first.term], kind: "contextual",
      },
      {
        id: `${target.term}:context:2`, target: target.term,
        text: `Within The Havenry, ${target.term}, ${first.term}, and ${second.term} support the room's composition.`,
        answers: [target.term, first.term, second.term], kind: "contextual",
      },
      {
        id: `${target.term}:context:3`, target: target.term,
        text: `Under Atmospheric Jurisdiction, ${target.term}, ${first.term}, ${second.term}, and ${third.term} establish a controlled experience.`,
        answers: [target.term, first.term, second.term, third.term], kind: "contextual",
      },
    ];

    return definitions.map((sentence) => ({
      ...sentence,
      difficulty: evaluateSentenceDifficulty(sentence.text, sentence.answers, target),
    }));
  });
}

export function selectSentenceRounds(terms: LexiconEntry[]): TrainingSentence[] {
  const bank = buildSentenceBank(terms);
  const buckets = Array.from({ length: 5 }, (_, index) =>
    bank.filter((sentence) => {
      const band = Math.min(4, Math.floor((sentence.difficulty - 1) / 2));
      return band === index;
    }),
  );
  const used = new Set<string>();
  return buckets.map((bucket, index) => {
    const available = shuffle(bucket).filter((sentence) => !used.has(sentence.target));
    const fallback = [...bank]
      .sort((a, b) => Math.abs(a.difficulty - (index * 2 + 2)) - Math.abs(b.difficulty - (index * 2 + 2)))
      .find((sentence) => !used.has(sentence.target));
    const selected = available[0] ?? fallback ?? bank[index % Math.max(1, bank.length)];
    if (selected) used.add(selected.target);
    return selected;
  }).filter((sentence): sentence is TrainingSentence => Boolean(sentence));
}

export function maskSentence(sentence: TrainingSentence): string {
  return [...sentence.answers]
    .sort((a, b) => b.length - a.length)
    .reduce((text, answer, index) => text.replace(answer, `{{${index}}}`), sentence.text);
}

export function roundAssessmentAdjustment(accuracy: number, paceRatio: number): number {
  if (accuracy >= 0.9 && paceRatio >= 0.5) return -30;
  if (accuracy < 0.6 || paceRatio < 0.15) return 30;
  return 0;
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

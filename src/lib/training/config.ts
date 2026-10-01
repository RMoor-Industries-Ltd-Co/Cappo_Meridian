/**
 * Tunable constants for Lexicon-Lingo training games. Centralized here instead
 * of scattered through components so game balance can be adjusted in one
 * place without touching render logic.
 */

// ─── Lexicon-Lingo Match ────────────────────────────────────────────────────

/**
 * Shared base-time ladder (seconds), by round index (0-based): 5:00, 4:00,
 * 3:00, 2:00, 1:00 — holds at 1:00 forever after the ladder ends. Used by
 * both Lexicon-Lingo Match (endless) and the Master's Game (fixed 5 rounds).
 */
export const BASE_SECONDS_LADDER = [300, 240, 180, 120, 60] as const;

/** Base time for a given round index (0-based), holding at the floor after the ladder ends. */
export function baseSecondsForRound(roundIndex: number): number {
  const ladder = BASE_SECONDS_LADDER;
  return ladder[Math.min(roundIndex, ladder.length - 1)];
}

/**
 * Pair count by round index (0-based): 5, 5, 6, 6, 7, 8, 8, 8, ... — holds at
 * the final value forever once the ladder ends.
 */
export const MATCH_PAIR_COUNT_LADDER = [5, 5, 6, 6, 7, 8] as const;

export function matchPairCountForRound(roundIndex: number, poolSize: number): number {
  const ladder = MATCH_PAIR_COUNT_LADDER;
  const target = ladder[Math.min(roundIndex, ladder.length - 1)];
  return Math.max(2, Math.min(target, poolSize));
}

/** Seconds deducted from whichever clock (base or Bonus Bank) is active on a wrong match. */
export const MATCH_MISMATCH_PENALTY_SECONDS = 3;

/** Round index (0-based) at which Match switches from the "easy" half of the pool to the "creative" half. */
export const MATCH_CREATIVE_SPLIT_ROUND = 5;

/** Round index (0-based) at which Match starts drawing from semantically-adjacent/confusable distractors. */
export const MATCH_CONFUSABLE_ROUND = 10;

export const MATCH_XP_PER_PAIR = 10;
export const MATCH_XP_PER_ROUND_CLEARED = 25;

// ─── Master's Game ──────────────────────────────────────────────────────────

/**
 * Five fixed rounds sharing ONE Bonus Bank across the whole run, using the
 * same {@link BASE_SECONDS_LADDER}. Round 1 is always Lexicon-Lingo Match
 * (a bounded number of pairs, not endless); rounds 2-5 draw from quiz
 * recognition and Conversation-style prompts. Any round's unused base time
 * banks forward, not just Match's — this generalizes PR #64's
 * Match-only-adds-bonus model.
 */
export const MASTER_ROUND_COUNT = 5;
export const MASTER_MATCH_PAIR_COUNT = 6;
export const MASTER_XP_PER_ROUND = 20;

// ─── Lingo in Conversation (untimed by default) ────────────────────────────

/**
 * Conversation is untimed standalone — difficulty is expressed through blank
 * count and distractor count, not a clock. (It is timed only when consumed
 * as a round inside the Master's Game, via that round's shared clock.)
 */
export const CONVERSATION_BLANKS_BY_DIFFICULTY: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 2,
  5: 3,
};
export const CONVERSATION_DISTRACTORS_BY_DIFFICULTY: Record<number, number> = {
  1: 2,
  2: 3,
  3: 3,
  4: 4,
  5: 5,
};
export const SENTENCE_XP_PER_CORRECT = 15;

// ─── Quick Quiz ─────────────────────────────────────────────────────────────

export const QUICK_QUIZ_XP_PER_CORRECT = 10;
export const QUICK_QUIZ_QUESTION_COUNT = 10;

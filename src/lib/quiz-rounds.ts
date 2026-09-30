/**
 * Shared round/timer math for the round-based Training games (Term Match,
 * Sentence Builder). Both follow the same shape: a fixed number of rounds,
 * time-per-round that shrinks linearly as rounds progress, and a
 * difficulty/size knob (pairs to match, blanks to fill) that grows the same
 * way — easy rounds first, "creative"/hardest content in the back half.
 */

/** Every round-based game runs exactly this many rounds. */
export const ROUND_COUNT = 10;

/** Round index (0-based) at which the pool switches from easy to creative terms. */
export const CREATIVE_SPLIT_ROUND = 5;

/**
 * Linear interpolation from `startSec` (round 0) down to `endSec` (the final
 * round), rounded to the nearest second. Callers pick `startSec` low enough
 * that round 0 already respects the "under 2:00" ceiling.
 */
export function timeForRound(roundIdx: number, startSec: number, endSec: number): number {
  const t = ROUND_COUNT <= 1 ? 0 : roundIdx / (ROUND_COUNT - 1);
  return Math.round(startSec + (endSec - startSec) * t);
}

/**
 * Linear growth from `startCount` (round 0) up to `endCount` (the final round),
 * rounded down so a round never demands more items than the previous one by
 * more than a whole unit.
 */
export function sizeForRound(roundIdx: number, startCount: number, endCount: number): number {
  const t = ROUND_COUNT <= 1 ? 0 : roundIdx / (ROUND_COUNT - 1);
  return Math.floor(startCount + (endCount - startCount) * t);
}

/**
 * Splits a difficulty-ranked term list into an "easy" half (rounds 1-5) and a
 * "creative" half (rounds 6-10). Falls back to the whole list for either half
 * when the pool is too small to split meaningfully, so a narrow category
 * selection still produces a playable session.
 */
export function splitByDifficulty<T>(rankedTerms: T[]): { easy: T[]; creative: T[] } {
  if (rankedTerms.length < 4) {
    return { easy: rankedTerms, creative: rankedTerms };
  }
  const mid = Math.ceil(rankedTerms.length / 2);
  return { easy: rankedTerms.slice(0, mid), creative: rankedTerms.slice(mid) };
}

/** Fisher-Yates shuffle — used wherever a stable, unbiased shuffle is needed. */
export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Picks `count` random items from `pool` without replacement (clamped to pool size). */
export function sample<T>(pool: T[], count: number): T[] {
  return shuffle(pool).slice(0, Math.min(count, pool.length));
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

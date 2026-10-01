/**
 * Pure Bonus Bank round-clock engine, shared by Lexicon-Lingo Match (endless
 * rounds) and the Master's Game (5 fixed rounds, one shared bank). Kept
 * side-effect-free and framework-free so it's directly unit-testable; a thin
 * `useRoundClock` React hook (see roundClockHook.ts) wraps it with a ticking
 * interval for components.
 *
 * Model: each round gets a base-time allotment. While base > 0, base ticks
 * down first. Once base reaches 0, the shared Bonus Bank is consumed instead.
 * Finishing a round's objective before its base time runs out banks the
 * unused base seconds (base time never "wastes"). A mismatch penalty always
 * comes out of whichever clock is currently active. The run ends once both
 * base and bank are exhausted with the round's objective still incomplete.
 */

export interface RoundClockState {
  roundIndex: number;
  baseRemaining: number;
  bonusBank: number;
  /** High-water mark of `bonusBank` ever reached this run — tracked here (not via a ref/effect in a component) so it rides the same state transitions as everything else. */
  maxBonusBank: number;
  usingBank: boolean;
  ended: boolean;
}

export type BaseSecondsForRound = (roundIndex: number) => number;

export function initRoundClock(baseSecondsForRound: BaseSecondsForRound, roundIndex = 0): RoundClockState {
  return {
    roundIndex,
    baseRemaining: baseSecondsForRound(roundIndex),
    bonusBank: 0,
    maxBonusBank: 0,
    usingBank: false,
    ended: false,
  };
}

function withMax(state: RoundClockState): RoundClockState {
  return state.bonusBank > state.maxBonusBank ? { ...state, maxBonusBank: state.bonusBank } : state;
}

/** Advance the active clock by one second. */
export function tickRoundClock(state: RoundClockState): RoundClockState {
  if (state.ended) return state;
  if (!state.usingBank) {
    if (state.baseRemaining > 1) {
      return { ...state, baseRemaining: state.baseRemaining - 1 };
    }
    // Base about to hit 0 — fall through to the bank, if any.
    if (state.bonusBank > 0) {
      return { ...state, baseRemaining: 0, usingBank: true, bonusBank: state.bonusBank - 1 };
    }
    return { ...state, baseRemaining: 0, ended: true };
  }
  if (state.bonusBank > 1) {
    return { ...state, bonusBank: state.bonusBank - 1 };
  }
  return { ...state, bonusBank: 0, ended: true };
}

/** Seconds remaining on whichever clock is currently active (what a timer display should show). */
export function activeSeconds(state: RoundClockState): number {
  return state.usingBank ? state.bonusBank : state.baseRemaining;
}

/** Total seconds the player still has available (base + bank), for an "all clocks" readout. */
export function totalSeconds(state: RoundClockState): number {
  return state.baseRemaining + state.bonusBank;
}

/** Deduct a penalty from whichever clock is active; ends the run if it exhausts both clocks. */
export function applyPenalty(state: RoundClockState, penaltySeconds: number): RoundClockState {
  if (state.ended || penaltySeconds <= 0) return state;
  let remaining = penaltySeconds;
  let { baseRemaining, bonusBank, usingBank } = state;

  if (!usingBank) {
    const fromBase = Math.min(baseRemaining, remaining);
    baseRemaining -= fromBase;
    remaining -= fromBase;
    if (baseRemaining <= 0 && remaining > 0) usingBank = true;
  }
  if (remaining > 0) {
    const fromBank = Math.min(bonusBank, remaining);
    bonusBank -= fromBank;
    remaining -= fromBank;
  }
  const ended = baseRemaining === 0 && bonusBank === 0 && usingBank;
  return withMax({ ...state, baseRemaining, bonusBank, usingBank, ended });
}

/**
 * The round's objective was completed before its clocks ran out: bank any
 * unused base time (bank time already being spent is never re-deposited —
 * `usingBank` rounds contribute nothing extra) and advance to the next round.
 */
export function completeRound(state: RoundClockState, baseSecondsForRound: BaseSecondsForRound): RoundClockState {
  if (state.ended) return state;
  const earned = state.usingBank ? 0 : state.baseRemaining;
  const nextRoundIndex = state.roundIndex + 1;
  return withMax({
    roundIndex: nextRoundIndex,
    baseRemaining: baseSecondsForRound(nextRoundIndex),
    bonusBank: state.bonusBank + earned,
    maxBonusBank: state.maxBonusBank,
    usingBank: false,
    ended: false,
  });
}

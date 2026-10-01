import { describe, expect, it } from "vitest";
import {
  activeSeconds,
  applyPenalty,
  completeRound,
  initRoundClock,
  tickRoundClock,
  totalSeconds,
  type BaseSecondsForRound,
} from "./roundClock";
import { baseSecondsForRound, BASE_SECONDS_LADDER } from "./config";

const ladder: BaseSecondsForRound = baseSecondsForRound;

function tickN(state: ReturnType<typeof initRoundClock>, n: number) {
  let s = state;
  for (let i = 0; i < n; i += 1) s = tickRoundClock(s);
  return s;
}

describe("base-time ladder", () => {
  it("is 5:00, 4:00, 3:00, 2:00, 1:00 for rounds 1-5", () => {
    expect(BASE_SECONDS_LADDER).toEqual([300, 240, 180, 120, 60]);
  });

  it("holds at 1:00 forever after round 5", () => {
    expect(ladder(4)).toBe(60);
    expect(ladder(5)).toBe(60);
    expect(ladder(9)).toBe(60);
    expect(ladder(100)).toBe(60);
  });
});

describe("Bonus Bank", () => {
  it("banks unused base time when a round is completed early", () => {
    const state = initRoundClock(ladder); // round 0, base 300
    const afterTicks = tickN(state, 100); // 200s left
    const completed = completeRound(afterTicks, ladder);
    expect(completed.bonusBank).toBe(200);
    expect(completed.roundIndex).toBe(1);
    expect(completed.baseRemaining).toBe(ladder(1));
  });

  it("persists the bank across multiple rounds", () => {
    let state = initRoundClock(ladder);
    state = tickN(state, 290); // 10s left of 300
    state = completeRound(state, ladder); // banks 10s, round 1 (base 240)
    expect(state.bonusBank).toBe(10);
    state = tickN(state, 235); // 5s left of 240
    state = completeRound(state, ladder); // banks 5s more
    expect(state.bonusBank).toBe(15);
  });

  it("consumes base time before touching the bank", () => {
    let state = initRoundClock(ladder);
    state = { ...state, bonusBank: 50 };
    state = tickN(state, 50); // still well inside base (300 - 50 = 250 left)
    expect(state.usingBank).toBe(false);
    expect(state.baseRemaining).toBe(250);
    expect(state.bonusBank).toBe(50); // untouched
  });

  it("switches to the bank only once base hits zero, then drains it", () => {
    let state = initRoundClock(() => 3); // tiny base for a fast test
    state = { ...state, bonusBank: 2 };
    state = tickRoundClock(state); // base 3 -> 2
    state = tickRoundClock(state); // base 2 -> 1
    state = tickRoundClock(state); // base 1 -> 0, falls into bank: bank 2 -> 1
    expect(state.usingBank).toBe(true);
    expect(state.baseRemaining).toBe(0);
    expect(state.bonusBank).toBe(1);
    expect(state.ended).toBe(false);
    state = tickRoundClock(state); // bank 1 -> 0, ends
    expect(state.bonusBank).toBe(0);
    expect(state.ended).toBe(true);
  });

  it("ends the run only once both base and bank are exhausted", () => {
    let state = initRoundClock(() => 1);
    state = tickRoundClock(state); // base -> 0, no bank -> ended
    expect(state.ended).toBe(true);
    expect(activeSeconds(state)).toBe(0);
  });

  it("never ticks past ended", () => {
    let state = initRoundClock(() => 1);
    state = tickRoundClock(state);
    const after = tickRoundClock(state);
    expect(after).toEqual(state);
  });

  it("tracks the all-time high-water mark across rounds", () => {
    let state = initRoundClock(ladder);
    state = tickN(state, 100); // 200 left
    state = completeRound(state, ladder); // bank = 200
    expect(state.maxBonusBank).toBe(200);
    state = tickN(state, 10); // spend 10 of base in round 2 (not bank)
    state = { ...state, usingBank: true, baseRemaining: 0 }; // force bank spend for the test
    state = tickRoundClock(state); // bank decreases
    expect(state.maxBonusBank).toBe(200); // high-water mark doesn't fall when bank is spent
  });

  it("reports total (base + bank) via totalSeconds", () => {
    const state = { ...initRoundClock(ladder), bonusBank: 15 };
    expect(totalSeconds(state)).toBe(ladder(0) + 15);
  });
});

describe("mismatch penalty", () => {
  it("deducts from base when base has enough left", () => {
    let state = initRoundClock(ladder);
    state = applyPenalty(state, 3);
    expect(state.baseRemaining).toBe(ladder(0) - 3);
    expect(state.ended).toBe(false);
  });

  it("spills into the bank once the penalty exceeds remaining base", () => {
    let state = { ...initRoundClock(() => 5), bonusBank: 10 };
    state = applyPenalty(state, 8); // 5 from base, 3 from bank
    expect(state.baseRemaining).toBe(0);
    expect(state.usingBank).toBe(true);
    expect(state.bonusBank).toBe(7);
    expect(state.ended).toBe(false);
  });

  it("ends the run exactly when a penalty exhausts both clocks", () => {
    let state = { ...initRoundClock(() => 2), bonusBank: 1 };
    state = applyPenalty(state, 3); // 2 from base, 1 from bank -> both zero
    expect(state.baseRemaining).toBe(0);
    expect(state.bonusBank).toBe(0);
    expect(state.ended).toBe(true);
  });

  it("clamps rather than going negative when the penalty overshoots", () => {
    let state = { ...initRoundClock(() => 2), bonusBank: 1 };
    state = applyPenalty(state, 100);
    expect(state.baseRemaining).toBe(0);
    expect(state.bonusBank).toBe(0);
    expect(state.ended).toBe(true);
  });

  it("is a no-op once the run has already ended", () => {
    let state = initRoundClock(() => 1);
    state = tickRoundClock(state);
    expect(state.ended).toBe(true);
    const after = applyPenalty(state, 5);
    expect(after).toEqual(state);
  });
});

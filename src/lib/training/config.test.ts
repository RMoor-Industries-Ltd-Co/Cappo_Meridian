import { describe, expect, it } from "vitest";
import { matchPairCountForRound, MATCH_PAIR_COUNT_LADDER } from "./config";

describe("Match pair-count progression", () => {
  it("is 5, 5, 6, 6, 7, 8 for rounds 1-6", () => {
    expect(MATCH_PAIR_COUNT_LADDER).toEqual([5, 5, 6, 6, 7, 8]);
  });

  it("holds at 8 forever past round 6 (ample pool)", () => {
    const bigPool = 100;
    expect(matchPairCountForRound(5, bigPool)).toBe(8);
    expect(matchPairCountForRound(20, bigPool)).toBe(8);
    expect(matchPairCountForRound(1000, bigPool)).toBe(8);
  });

  it("increases monotonically across the ladder", () => {
    const bigPool = 100;
    const counts = Array.from({ length: 6 }, (_, i) => matchPairCountForRound(i, bigPool));
    for (let i = 1; i < counts.length; i += 1) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    }
  });

  it("never asks for more pairs than the selected pool actually has", () => {
    expect(matchPairCountForRound(5, 3)).toBeLessThanOrEqual(3);
    expect(matchPairCountForRound(0, 2)).toBeLessThanOrEqual(2);
  });
});

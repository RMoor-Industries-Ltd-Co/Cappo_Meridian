import { describe, expect, it } from "vitest";
import { shuffle, formatClock } from "./shuffle";

describe("shuffle (Fisher-Yates)", () => {
  it("returns a permutation — same length, same multiset of elements", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const result = shuffle(input);
    expect(result).toHaveLength(input.length);
    expect([...result].sort()).toEqual([...input].sort());
  });

  it("does not mutate the input array", () => {
    const input = [1, 2, 3];
    const copy = [...input];
    shuffle(input);
    expect(input).toEqual(copy);
  });

  it("is deterministic given a seeded random source", () => {
    let calls = 0;
    const seeded = () => {
      const values = [0.9, 0.1, 0.5, 0.0];
      return values[calls++ % values.length];
    };
    const a = shuffle([1, 2, 3, 4], seeded);
    calls = 0;
    const b = shuffle([1, 2, 3, 4], seeded);
    expect(a).toEqual(b);
  });

  it("every index can end up out of its original place over many trials (not an identity no-op)", () => {
    const input = Array.from({ length: 10 }, (_, i) => i);
    let everMoved = false;
    for (let trial = 0; trial < 50 && !everMoved; trial += 1) {
      const result = shuffle(input);
      if (result.some((value, index) => value !== index)) everMoved = true;
    }
    expect(everMoved).toBe(true);
  });
});

describe("formatClock", () => {
  it("formats whole minutes and seconds", () => {
    expect(formatClock(300)).toBe("5:00");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(5)).toBe("0:05");
  });

  it("clamps negative values to 0:00", () => {
    expect(formatClock(-5)).toBe("0:00");
  });

  it("rounds fractional seconds up", () => {
    expect(formatClock(59.2)).toBe("1:00");
  });
});

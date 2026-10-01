import { describe, expect, it } from "vitest";
import {
  splitEntries,
  splitTags,
  parseTrainingAudiences,
  parseCorpusStatus,
  parseTrainingDifficulty,
  TRAINING_AUDIENCES,
} from "./corpusText";

describe("splitEntries", () => {
  it("splits on newlines, trims, and drops empties", () => {
    expect(splitEntries("First line\n\nSecond line\n  Third  ")).toEqual([
      "First line",
      "Second line",
      "Third",
    ]);
  });

  it("strips a leading bullet marker", () => {
    expect(splitEntries("- One\n* Two\n• Three")).toEqual(["One", "Two", "Three"]);
  });

  it("returns [] for null/undefined/empty", () => {
    expect(splitEntries(null)).toEqual([]);
    expect(splitEntries(undefined)).toEqual([]);
    expect(splitEntries("")).toEqual([]);
  });
});

describe("splitTags", () => {
  it("splits on commas and newlines", () => {
    expect(splitTags("Supplier, Wholesaler\nDesigner")).toEqual(["Supplier", "Wholesaler", "Designer"]);
  });
});

describe("parseTrainingAudiences", () => {
  it("normalizes known audiences case-insensitively", () => {
    expect(parseTrainingAudiences("supplier, WHOLESALER")).toEqual(["Supplier", "Wholesaler"]);
  });

  it("drops unrecognized tags rather than inventing new audiences", () => {
    expect(parseTrainingAudiences("Supplier, Astronaut")).toEqual(["Supplier"]);
  });

  it("dedupes repeated tags", () => {
    expect(parseTrainingAudiences("Supplier, supplier, Supplier")).toEqual(["Supplier"]);
  });

  it("covers every known audience", () => {
    expect(parseTrainingAudiences(TRAINING_AUDIENCES.join(", "))).toEqual([...TRAINING_AUDIENCES]);
  });
});

describe("parseCorpusStatus", () => {
  it("parses Seed/Review/Approved case-insensitively", () => {
    expect(parseCorpusStatus("Approved")).toBe("approved");
    expect(parseCorpusStatus("review")).toBe("review");
    expect(parseCorpusStatus("SEED")).toBe("seed");
  });

  it("defaults unset/unrecognized values to the conservative 'seed'", () => {
    expect(parseCorpusStatus(null)).toBe("seed");
    expect(parseCorpusStatus(undefined)).toBe("seed");
    expect(parseCorpusStatus("")).toBe("seed");
    expect(parseCorpusStatus("Final")).toBe("seed");
  });
});

describe("parseTrainingDifficulty", () => {
  it("parses a numeric 1-10 value", () => {
    expect(parseTrainingDifficulty("7")).toBe(7);
  });

  it("clamps out-of-range numbers to 1-10", () => {
    expect(parseTrainingDifficulty("0")).toBe(1);
    expect(parseTrainingDifficulty("99")).toBe(10);
  });

  it("parses easy/medium/advanced onto the scale", () => {
    expect(parseTrainingDifficulty("Easy")).toBe(2);
    expect(parseTrainingDifficulty("medium")).toBe(5);
    expect(parseTrainingDifficulty("ADVANCED")).toBe(8);
  });

  it("returns null for unset/unparseable values", () => {
    expect(parseTrainingDifficulty(null)).toBeNull();
    expect(parseTrainingDifficulty("")).toBeNull();
    expect(parseTrainingDifficulty("spicy")).toBeNull();
  });
});

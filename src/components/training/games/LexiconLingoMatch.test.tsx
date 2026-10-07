import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { LexiconEntry } from "@/lib/lexicon-data";
import { LexiconLingoMatch } from "./LexiconLingoMatch";

/**
 * Validates the useRoundClock + component wiring itself (countdown display,
 * Bonus Bank transfer, mismatch penalty) — not just the pure roundClock
 * reducer, which already has its own dedicated unit tests.
 */

function term(partial: Partial<LexiconEntry> & { term: string; plain: string; category: string }): LexiconEntry {
  return { meaning: `${partial.term} meaning`, use: "test", example: `${partial.term} example`, ...partial };
}

// Exactly 5 terms: round 1's pair-count target (5) exceeds the easy half
// (ceil(5/2)=3), so selectMatchRound falls back to the full pool — every
// round in this test draws from all 5, keeping the test deterministic.
const TERMS: LexiconEntry[] = [
  term({ term: "T0", plain: "P0", category: "Cat" }),
  term({ term: "T1", plain: "P1", category: "Cat" }),
  term({ term: "T2", plain: "P2", category: "Cat" }),
  term({ term: "T3", plain: "P3", category: "Cat" }),
  term({ term: "T4", plain: "P4", category: "Cat" }),
];

/**
 * Renders and clicks past the intro screen. Deliberately avoids
 * findBy/waitFor here: the "Start Round 1" button renders on the very first
 * synchronous render (it isn't gated behind the personal-best fetch), and
 * the intro->playing transition is a synchronous setState inside the click
 * handler — so a plain getBy right after fireEvent is correct, and (unlike
 * findBy's setTimeout-based polling) it isn't blocked by fake timers.
 */
function startRound() {
  render(<LexiconLingoMatch terms={TERMS} founder="Founder 55" categories={["Cat"]} onExit={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /start round 1/i }));
  // Confirms the intro -> playing transition happened synchronously.
  screen.getByRole("group", { name: /lexicon terms/i });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init) return { json: async () => ({ ok: true, best: null }) } as Response;
      return { json: async () => ({ ok: true, best: null, isNewBest: false }) } as Response;
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Lexicon-Lingo Match — UI wiring", () => {
  it("shows Round 1 starting at 5:00 with an empty Bonus Bank", () => {
    startRound();
    expect(screen.getByText("5:00")).toBeInTheDocument();
    expect(screen.getByText(/bonus bank/i).textContent).toContain("0:00");
  });

  it("deducts the mismatch penalty immediately from the active clock", () => {
    startRound();
    const termGroup = screen.getByRole("group", { name: /lexicon terms/i });
    const plainGroup = screen.getByRole("group", { name: /plain-language meanings/i });

    fireEvent.click(within(termGroup).getByText("T0"));
    fireEvent.click(within(plainGroup).getByText("P1")); // wrong pair

    expect(screen.getByText("4:57")).toBeInTheDocument(); // 5:00 - 3s penalty, no tick elapsed
  });

  it("matches a correct pair, locking both cards", () => {
    startRound();
    const termGroup = screen.getByRole("group", { name: /lexicon terms/i });
    const plainGroup = screen.getByRole("group", { name: /plain-language meanings/i });

    fireEvent.click(within(termGroup).getByText("T0"));
    fireEvent.click(within(plainGroup).getByText("P0"));

    expect(within(termGroup).getByText("T0").closest("button")).toBeDisabled();
    expect(within(plainGroup).getByText("P0").closest("button")).toBeDisabled();
  });

  it("banks the full remaining base time when a round clears with no ticks elapsed", () => {
    startRound();
    const termGroup = screen.getByRole("group", { name: /lexicon terms/i });
    const plainGroup = screen.getByRole("group", { name: /plain-language meanings/i });

    // Match all 5 pairs instantly (no fake-timer advance) so round 1's full
    // 5:00 base rolls into the Bonus Bank and round 2 (4:00 base) starts.
    for (const name of ["T0", "T1", "T2", "T3", "T4"]) {
      fireEvent.click(within(termGroup).getByText(name));
      fireEvent.click(within(plainGroup).getByText(name.replace("T", "P")));
    }

    expect(screen.getByText((_, element) => element?.tagName === "P" && /round 2$/i.test(element.textContent ?? ""))).toBeInTheDocument();
    expect(screen.getByText("4:00")).toBeInTheDocument(); // round 2's own base
    expect(screen.getByText(/bonus bank/i).textContent).toContain("5:00"); // all of round 1 banked
  });

  it("consumes base time with real ticks before touching the bank", () => {
    startRound();
    // Clear round 1 with no elapsed time so round 2 starts with a 5:00 bank.
    const termGroup = screen.getByRole("group", { name: /lexicon terms/i });
    const plainGroup = screen.getByRole("group", { name: /plain-language meanings/i });
    for (const name of ["T0", "T1", "T2", "T3", "T4"]) {
      fireEvent.click(within(termGroup).getByText(name));
      fireEvent.click(within(plainGroup).getByText(name.replace("T", "P")));
    }
    screen.getByText((_, element) => element?.tagName === "P" && /round 2$/i.test(element.textContent ?? ""));

    act(() => {
      vi.advanceTimersByTime(5000); // 5 real seconds tick off round 2's base (4:00 -> 3:55)
    });

    expect(screen.getByText("3:55")).toBeInTheDocument();
    expect(screen.getByText(/bonus bank/i).textContent).toContain("5:00"); // bank untouched
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { LexiconEntry } from "@/lib/lexicon-data";
import type { LexiconSentenceExample } from "@/lib/training/sentenceCorpus";
import { SentenceCard } from "./LingoInConversation";

afterEach(() => cleanup());

function term(overrides: Partial<LexiconEntry> & { term: string }): LexiconEntry {
  return {
    meaning: `${overrides.term} meaning`,
    use: `${overrides.term} use`,
    plain: `${overrides.term} plain`,
    example: `${overrides.term} example`,
    category: "Brand Language",
    ...overrides,
  };
}

const TERMS: LexiconEntry[] = [
  term({ term: "Ember Line" }),
  term({ term: "Aure" }),
  term({ term: "Drift" }),
  term({ term: "Sanctum" }),
  term({ term: "Prime Anchor" }),
];

const SINGLE_BLANK: LexiconSentenceExample = {
  id: "single",
  terms: ["Ember Line"],
  text: "Place the Ember Line on the stone tray and let it burn.",
  kind: "short",
  difficulty: 1,
  approved: true,
  source: "curated",
  scenarios: [],
  audiences: [],
};

const MULTI_BLANK: LexiconSentenceExample = {
  id: "multi",
  terms: ["Ember Line", "Aure", "Drift"],
  text: "The Ember Line expresses the Aure during the burn, and the Drift remains afterward.",
  kind: "compound",
  difficulty: 7,
  approved: true,
  source: "curated",
  scenarios: [],
  audiences: [],
};

describe("SentenceCard — single blank", () => {
  it("disables Continue until the blank is filled, then grades correctly", () => {
    const onSubmit = vi.fn();
    render(<SentenceCard sentence={SINGLE_BLANK} terms={TERMS} onSubmit={onSubmit} />);

    expect(screen.getByRole("button", { name: /^continue$/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Ember Line" }));
    expect(screen.getByRole("button", { name: /^continue$/i })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    // Graded correct: no "Correct: ..." reveal, and a Next button appears.
    expect(screen.queryByText(/^correct:/i)).not.toBeInTheDocument();
    const nextBtn = screen.getByRole("button", { name: /^next$/i });
    fireEvent.click(nextBtn);
    expect(onSubmit).toHaveBeenCalledWith(true);
  });

  it("lets a placed word be removed and re-picked before Continue", () => {
    const onSubmit = vi.fn();
    render(<SentenceCard sentence={SINGLE_BLANK} terms={TERMS} onSubmit={onSubmit} />);

    const bankWord = screen.getByRole("button", { name: "Ember Line" });
    fireEvent.click(bankWord);
    expect(bankWord).toBeDisabled(); // used

    // The blank itself is now a button showing "Ember Line" — click to clear it.
    const blank = screen.getAllByRole("button").find((b) => b.textContent === "Ember Line" && b !== bankWord);
    expect(blank).toBeDefined();
    fireEvent.click(blank!);

    expect(screen.getByRole("button", { name: /^continue$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ember Line" })).not.toBeDisabled();
  });

  it("never grades on each tap — only on Continue", () => {
    const onSubmit = vi.fn();
    render(<SentenceCard sentence={SINGLE_BLANK} terms={TERMS} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Ember Line" }));
    expect(screen.queryByRole("button", { name: /^next$/i })).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("SentenceCard — multiple blanks fill in visual (reading) order", () => {
  it("fills the next visually-empty blank regardless of which bank word is tapped first", () => {
    const onSubmit = vi.fn();
    const { container } = render(<SentenceCard sentence={MULTI_BLANK} terms={TERMS} onSubmit={onSubmit} />);

    // Tap "Aure" first — it should land in the FIRST blank the sentence reads
    // left-to-right (that blank's correct answer is actually "Ember Line"),
    // not in whatever slot "Aure" itself belongs to.
    fireEvent.click(screen.getByRole("button", { name: "Aure" }));
    const sentenceParagraph = container.querySelector("p")!;
    const firstBlank = sentenceParagraph.querySelectorAll("button")[0];
    expect(firstBlank.textContent).toBe("Aure");

    fireEvent.click(screen.getByRole("button", { name: "Drift" }));
    fireEvent.click(screen.getByRole("button", { name: "Ember Line" }));

    expect(screen.getByRole("button", { name: /^continue$/i })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    // All three placements are mismatched against their slot's actual correct term,
    // so grading is incorrect and the correct reconstruction is revealed.
    expect(screen.getByText(/^correct:/i)).toBeInTheDocument();
    expect(screen.getByText(MULTI_BLANK.text)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    expect(onSubmit).toHaveBeenCalledWith(false);
  });

  it("keeps the word bank to at most 7 choices and includes every correct term", () => {
    render(<SentenceCard sentence={MULTI_BLANK} terms={TERMS} onSubmit={() => {}} />);
    const bankGroup = screen.getByRole("group", { name: /word bank/i });
    const bankButtons = bankGroup.querySelectorAll("button");
    expect(bankButtons.length).toBeLessThanOrEqual(7);
    for (const correct of MULTI_BLANK.terms) {
      expect(screen.getByRole("button", { name: correct })).toBeInTheDocument();
    }
  });
});

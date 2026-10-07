"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Clock3 } from "lucide-react";
import type { TrainingGameProps } from "@/lib/training/registry";
import { baseSecondsForRound, MASTER_MATCH_PAIR_COUNT, MASTER_ROUND_COUNT, MASTER_XP_PER_ROUND } from "@/lib/training/config";
import { selectMatchRound } from "@/lib/training/matchPool";
import { shuffle, formatClock } from "@/lib/training/shuffle";
import { useRoundClock } from "../useRoundClock";
import { Results } from "../Results";

const MATCH_ROUND_INDEX = 0;
const RECOGNITION_PER_ROUND = 4;

/**
 * Early/preview build: validates the shared-clock, shared-Bonus-Bank
 * contract across 5 fixed rounds (Match first, then recognition rounds),
 * using the same base-time ladder as Lexicon-Lingo Match. Deliberately not
 * polished into the full Master's Game experience yet — see the Lexicon-Lingo
 * directive's "do not fully expand Master's Game" guardrail. Content per
 * round (which exercises appear, how many) is the part expected to change
 * once Match and Conversation are themselves stable.
 */
export function MastersGame({ terms, founder, categories, onExit }: TrainingGameProps) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const finishedAllRounds = roundIndex >= MASTER_ROUND_COUNT;
  const clock = useRoundClock(baseSecondsForRound, !finishedAllRounds);
  const done = clock.state.ended || finishedAllRounds;

  if (done) {
    return (
      <Results
        founder={founder}
        mode="Master's Game"
        categories={categories}
        summary={{ score: correct, total: Math.max(total, 1), xp: correct * MASTER_XP_PER_ROUND, metrics: { bonusBankSecondsRemaining: clock.state.bonusBank } }}
        onRestart={() => window.location.reload()}
        onExit={onExit}
      />
    );
  }

  const header = (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted">Master round {roundIndex + 1}/{MASTER_ROUND_COUNT}</p>
        <h2 className="text-2xl font-bold text-gold">Master&apos;s Game <span className="text-xs font-normal text-muted">(preview)</span></h2>
      </div>
      <div className="flex items-center gap-2 text-gold">
        <Clock3 size={16} aria-hidden="true" />
        <span className="font-semibold">{formatClock(clock.activeSeconds)}</span>
        {clock.state.bonusBank > 0 && <span className="text-xs text-subtle">(+{formatClock(clock.state.bonusBank)} bank)</span>}
      </div>
    </div>
  );

  if (roundIndex === MATCH_ROUND_INDEX) {
    return (
      <MasterMatchRound
        terms={terms}
        header={header}
        onExit={onExit}
        onRoundDone={(roundCorrect, roundTotal) => {
          setCorrect((v) => v + roundCorrect);
          setTotal((v) => v + roundTotal);
          clock.completeRoundNow();
          setRoundIndex((v) => v + 1);
        }}
      />
    );
  }

  return (
    <MasterRecognitionRound
      terms={terms}
      header={header}
      onExit={onExit}
      onRoundDone={(roundCorrect, roundTotal) => {
        setCorrect((v) => v + roundCorrect);
        setTotal((v) => v + roundTotal);
        clock.completeRoundNow();
        setRoundIndex((v) => v + 1);
      }}
    />
  );
}

function MasterMatchRound({
  terms,
  header,
  onExit,
  onRoundDone,
}: {
  terms: TrainingGameProps["terms"];
  header: ReactNode;
  onExit: () => void;
  onRoundDone: (correct: number, total: number) => void;
}) {
  const cards = useMemo(() => selectMatchRound(terms, 0).slice(0, MASTER_MATCH_PAIR_COUNT), [terms]);
  const termCards = useMemo(() => shuffle(cards), [cards]);
  const plainCards = useMemo(() => shuffle(cards), [cards]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<{ side: "term" | "plain"; term: string } | null>(null);

  useEffect(() => {
    if (cards.length > 0 && matched.size === cards.length) onRoundDone(matched.size, cards.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched.size, cards.length]);

  const pick = (side: "term" | "plain", term: string) => {
    if (matched.has(term)) return;
    if (!selection || selection.side === side) {
      setSelection({ side, term });
      return;
    }
    if (selection.term === term) setMatched((current) => new Set(current).add(term));
    setSelection(null);
  };

  return (
    <div className="max-w-5xl pt-2 flex flex-col gap-5">
      <button onClick={onExit} className="flex items-center gap-2 text-xs text-muted"><ArrowLeft size={14} /> Training menu</button>
      {header}
      <p className="text-sm text-subtle">Match {MASTER_MATCH_PAIR_COUNT} pairs to open the Bonus Bank for the rest of the game.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          {termCards.map((card) => (
            <button
              key={card.term}
              disabled={matched.has(card.term)}
              onClick={() => pick("term", card.term)}
              className={`rounded-xl border p-3 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${matched.has(card.term) ? "border-gold/20 text-muted opacity-40" : selection?.side === "term" && selection.term === card.term ? "border-gold bg-gold/10 text-gold" : "border-border bg-panel text-fg"}`}
            >
              {card.term}
            </button>
          ))}
        </div>
        <div className="grid gap-2">
          {plainCards.map((card) => (
            <button
              key={card.term}
              disabled={matched.has(card.term)}
              onClick={() => pick("plain", card.term)}
              className={`rounded-xl border p-3 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${matched.has(card.term) ? "border-gold/20 text-muted opacity-40" : selection?.side === "plain" && selection.term === card.term ? "border-gold bg-gold/10 text-gold" : "border-border bg-panel text-fg"}`}
            >
              {card.plain}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MasterRecognitionRound({
  terms,
  header,
  onExit,
  onRoundDone,
}: {
  terms: TrainingGameProps["terms"];
  header: ReactNode;
  onExit: () => void;
  onRoundDone: (correct: number, total: number) => void;
}) {
  const [questions] = useState(() => shuffle(terms).slice(0, Math.min(RECOGNITION_PER_ROUND, terms.length)));
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const current = questions[index];
  const options = useMemo(
    () =>
      current
        ? shuffle([current.plain, ...shuffle(terms.filter((t) => t.term !== current.term)).slice(0, 3).map((t) => t.plain)])
        : [],
    [current, terms],
  );

  if (!current) {
    onRoundDone(correct, questions.length);
    return null;
  }

  return (
    <div className="max-w-2xl pt-2 flex flex-col gap-5">
      <button onClick={onExit} className="flex items-center gap-2 text-xs text-muted"><ArrowLeft size={14} /> Training menu</button>
      {header}
      <div className="rounded-2xl border border-border bg-panel p-6 flex flex-col gap-4">
        <h3 className="text-xl font-semibold text-fg">{current.term}</h3>
        <p className="text-sm text-subtle">Choose its real-world meaning.</p>
        {options.map((option) => (
          <button
            key={option}
            onClick={() => {
              const wasCorrect = option === current.plain;
              if (index + 1 >= questions.length) onRoundDone(correct + (wasCorrect ? 1 : 0), questions.length);
              else {
                if (wasCorrect) setCorrect((v) => v + 1);
                setIndex((v) => v + 1);
              }
            }}
            className="rounded-xl border border-border p-3 text-left text-sm text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

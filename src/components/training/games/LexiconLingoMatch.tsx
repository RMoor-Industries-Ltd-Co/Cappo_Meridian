"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3 } from "lucide-react";
import type { TrainingGameProps } from "@/lib/training/registry";
import { baseSecondsForRound, MATCH_MISMATCH_PENALTY_SECONDS, MATCH_XP_PER_PAIR, MATCH_XP_PER_ROUND_CLEARED } from "@/lib/training/config";
import { selectMatchRound } from "@/lib/training/matchPool";
import { shuffle, formatClock } from "@/lib/training/shuffle";
import { useRoundClock } from "../useRoundClock";
import type { TrainingPersonalBest } from "@/lib/db";

const MODE = "Lexicon-Lingo Match" as const;

interface RunStats {
  pairsMatched: number;
  mismatches: number;
  xp: number;
}

async function fetchPersonalBest(founder: TrainingGameProps["founder"]): Promise<TrainingPersonalBest | null> {
  try {
    const res = await fetch(`/api/training/personal-best?founder=${encodeURIComponent(founder)}&mode=${encodeURIComponent(MODE)}`);
    const json = await res.json();
    return json.ok ? json.best : null;
  } catch {
    return null;
  }
}

async function submitPersonalBest(
  founder: TrainingGameProps["founder"],
  stats: RunStats & { highestRound: number; maxBonusBank: number },
) {
  const accuracy = stats.pairsMatched + stats.mismatches > 0 ? stats.pairsMatched / (stats.pairsMatched + stats.mismatches) : 0;
  try {
    const res = await fetch("/api/training/personal-best", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        founder,
        mode: MODE,
        highestRound: stats.highestRound,
        pairsMatched: stats.pairsMatched,
        accuracy,
        maxBonusBankSeconds: stats.maxBonusBank,
        xp: stats.xp,
      }),
    });
    const json = await res.json();
    return json.ok ? { best: json.best as TrainingPersonalBest | null, isNewBest: Boolean(json.isNewBest) } : { best: null, isNewBest: false };
  } catch {
    return { best: null, isNewBest: false };
  }
}

export function LexiconLingoMatch({ terms, founder, onExit }: TrainingGameProps) {
  const [screen, setScreen] = useState<"intro" | "playing" | "results">("intro");
  const [personalBest, setPersonalBest] = useState<TrainingPersonalBest | null>(null);
  const [loadingBest, setLoadingBest] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchPersonalBest(founder).then((best) => {
      if (!cancelled) {
        setPersonalBest(best);
        setLoadingBest(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [founder]);

  if (screen === "intro") {
    return (
      <Intro
        termCount={terms.length}
        personalBest={personalBest}
        loadingBest={loadingBest}
        onExit={onExit}
        onStart={() => setScreen("playing")}
      />
    );
  }

  return <MatchRun terms={terms} founder={founder} personalBest={personalBest} onExit={onExit} />;
}

function Intro({
  termCount,
  personalBest,
  loadingBest,
  onExit,
  onStart,
}: {
  termCount: number;
  personalBest: TrainingPersonalBest | null;
  loadingBest: boolean;
  onExit: () => void;
  onStart: () => void;
}) {
  const canPlay = termCount >= 5;
  return (
    <div className="max-w-2xl pt-2 flex flex-col gap-6">
      <button onClick={onExit} className="flex items-center gap-2 text-xs text-muted">
        <ArrowLeft size={14} /> Training menu
      </button>
      <div>
        <h1 className="text-3xl font-bold text-gold">Lexicon-Lingo Match</h1>
        <p className="mt-2 text-sm text-subtle">
          Match HVN language to its real-world meaning before your time runs out. There is no final
          round — keep going until your clock and your Bonus Bank both run out, and try to beat your
          personal best.
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-panel p-5 flex flex-col gap-2 text-sm text-subtle">
        <p>Round 1 starts at <span className="font-semibold text-fg">5:00</span>; the clock shortens each round down to <span className="font-semibold text-fg">1:00</span>, then holds there forever.</p>
        <p>Clear a round early and the time you didn&apos;t use rolls into your <span className="font-semibold text-gold">Bonus Bank</span> — it carries forward and is only spent once a round&apos;s own clock hits zero.</p>
        <p>A wrong match costs {MATCH_MISMATCH_PENALTY_SECONDS} seconds off whichever clock is running.</p>
      </div>
      {!loadingBest && (
        <p className="text-xs text-muted">
          {personalBest ? (
            <>Personal best: <span className="font-semibold text-gold">Round {personalBest.highest_round}</span></>
          ) : (
            "No personal best yet — this will set one."
          )}
        </p>
      )}
      <button
        onClick={onStart}
        disabled={!canPlay}
        className="w-full rounded-xl border border-gold/60 bg-gold/10 py-3 text-sm font-semibold text-gold hover:bg-gold/20 disabled:opacity-40"
      >
        Start Round 1
      </button>
      {!canPlay && <p className="text-xs text-red-400">Select categories with at least 5 terms to play Match.</p>}
    </div>
  );
}

function MatchRun({
  terms,
  founder,
  personalBest,
  onExit,
}: {
  terms: TrainingGameProps["terms"];
  founder: TrainingGameProps["founder"];
  personalBest: TrainingPersonalBest | null;
  onExit: () => void;
}) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<{ side: "term" | "plain"; term: string } | null>(null);
  const [wrongFlash, setWrongFlash] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<RunStats>({ pairsMatched: 0, mismatches: 0, xp: 0 });
  const [submitted, setSubmitted] = useState<{ best: TrainingPersonalBest | null; isNewBest: boolean } | null>(null);

  const clock = useRoundClock(baseSecondsForRound, true);
  const ended = clock.state.ended;

  const cards = useMemo(() => selectMatchRound(terms, roundIndex), [terms, roundIndex]);
  const termCards = useMemo(() => shuffle(cards), [cards]);
  const plainCards = useMemo(() => shuffle(cards), [cards]);

  useEffect(() => {
    if (ended && !submitted) {
      submitPersonalBest(founder, { ...stats, maxBonusBank: clock.state.maxBonusBank, highestRound: roundIndex }).then(setSubmitted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  const pick = (side: "term" | "plain", term: string) => {
    if (ended || matched.has(term)) return;
    if (!selection || selection.side === side) {
      setSelection({ side, term });
      return;
    }
    if (selection.term === term) {
      const newMatched = new Set(matched).add(term);
      const roundCleared = newMatched.size === cards.length;
      setSelection(null);
      setStats((current) => ({
        ...current,
        pairsMatched: current.pairsMatched + 1,
        xp: current.xp + MATCH_XP_PER_PAIR + (roundCleared ? MATCH_XP_PER_ROUND_CLEARED : 0),
      }));
      if (roundCleared) {
        clock.completeRoundNow();
        setRoundIndex((value) => value + 1);
        setMatched(new Set());
        setWrongFlash(new Set());
      } else {
        setMatched(newMatched);
      }
    } else {
      const flash = new Set([`${selection.side}:${selection.term}`, `${side}:${term}`]);
      setWrongFlash(flash);
      setStats((current) => ({ ...current, mismatches: current.mismatches + 1 }));
      clock.penalize(MATCH_MISMATCH_PENALTY_SECONDS);
      setSelection(null);
      setTimeout(() => setWrongFlash(new Set()), clock.reducedMotion ? 0 : 500);
    }
  };

  if (ended) {
    const accuracy = stats.pairsMatched + stats.mismatches > 0 ? stats.pairsMatched / (stats.pairsMatched + stats.mismatches) : 0;
    const isNewBest = submitted?.isNewBest ?? false;
    const bestRound = submitted?.best?.highest_round ?? personalBest?.highest_round ?? 0;
    return (
      <div className="max-w-2xl pt-2 flex flex-col gap-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Lexicon-Lingo Match</p>
          <h1 className="mt-2 text-3xl font-bold text-gold">Run complete</h1>
        </div>
        <div className="rounded-2xl border border-border bg-panel p-6 flex flex-col gap-3">
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-bold text-gold">Round {roundIndex}</span>
          </div>
          <p className="text-sm text-subtle">{stats.pairsMatched} pairs matched · {Math.round(accuracy * 100)}% accuracy</p>
          <p className="text-sm text-subtle">XP earned: <span className="font-semibold text-gold">+{stats.xp}</span></p>
          {isNewBest ? (
            <p className="text-sm font-semibold text-gold">New personal best!</p>
          ) : bestRound > 0 ? (
            <p className="text-xs text-muted">Personal best: Round {bestRound}</p>
          ) : null}
        </div>
        <div className="flex gap-3">
          <button onClick={() => window.location.reload()} className="flex-1 rounded-xl border border-border bg-panel py-3 text-sm text-fg">Try again</button>
          <button onClick={onExit} className="flex-1 rounded-xl border border-border bg-panel py-3 text-sm text-subtle">Training menu</button>
        </div>
      </div>
    );
  }

  const urgent = clock.activeSeconds <= 10;

  return (
    <div className="max-w-5xl pt-2 flex flex-col gap-5">
      <button onClick={onExit} className="flex items-center gap-2 text-xs text-muted">
        <ArrowLeft size={14} /> Training menu
      </button>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Round {roundIndex + 1}</p>
          <h2 className="text-2xl font-bold text-gold">Lexicon-Lingo Match</h2>
        </div>
        <div className="flex items-center gap-4" aria-live="polite">
          <div className={`flex items-center gap-2 ${urgent ? "text-red-400" : "text-gold"}`}>
            <Clock3 size={16} aria-hidden="true" />
            <span className="font-semibold">{formatClock(clock.activeSeconds)}</span>
            <span className="sr-only">{clock.state.usingBank ? "Bonus Bank time remaining" : "Round time remaining"}</span>
          </div>
          <div className="text-xs text-subtle">
            Bonus Bank: <span className="font-semibold text-gold">{formatClock(clock.state.bonusBank)}</span>
          </div>
        </div>
      </div>
      <p className="text-sm text-subtle">
        {roundIndex < 5
          ? "Everyday HVN terms."
          : roundIndex < 10
            ? "More creative, multi-word phrases."
            : "Closely related terms from the same family — read carefully."}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2" role="group" aria-label="Lexicon terms">
          {termCards.map((card) => {
            const isMatched = matched.has(card.term);
            const isSelected = selection?.side === "term" && selection.term === card.term;
            const isWrong = wrongFlash.has(`term:${card.term}`);
            return (
              <button
                key={card.term}
                data-term={card.term}
                disabled={isMatched}
                onClick={() => pick("term", card.term)}
                aria-pressed={isSelected}
                className={[
                  "rounded-xl border p-3 text-left text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold",
                  isMatched
                    ? "border-gold/20 text-muted opacity-40"
                    : isWrong
                      ? "border-red-500/60 bg-red-500/10 text-red-400"
                      : isSelected
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-border bg-panel text-fg hover:border-gold/40",
                ].join(" ")}
              >
                {card.term}
              </button>
            );
          })}
        </div>
        <div className="grid gap-2" role="group" aria-label="Plain-language meanings">
          {plainCards.map((card) => {
            const isMatched = matched.has(card.term);
            const isSelected = selection?.side === "plain" && selection.term === card.term;
            const isWrong = wrongFlash.has(`plain:${card.term}`);
            return (
              <button
                key={card.term}
                data-term={card.term}
                disabled={isMatched}
                onClick={() => pick("plain", card.term)}
                aria-pressed={isSelected}
                className={[
                  "rounded-xl border p-3 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold",
                  isMatched
                    ? "border-gold/20 text-muted opacity-40"
                    : isWrong
                      ? "border-red-500/60 bg-red-500/10 text-red-400"
                      : isSelected
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-border bg-panel text-subtle hover:border-gold/40",
                ].join(" ")}
              >
                {card.plain}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

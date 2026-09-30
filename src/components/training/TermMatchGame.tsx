"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, Timer, ArrowLeft } from "lucide-react";
import type { LexiconEntry } from "@/lib/lexicon-data";
import { rankByDifficulty } from "@/lib/lexicon-data";
import {
  ROUND_COUNT,
  CREATIVE_SPLIT_ROUND,
  timeForRound,
  sizeForRound,
  splitByDifficulty,
  shuffle,
  sample,
  formatClock,
} from "@/lib/quiz-rounds";
import { ValeHost } from "./ValeHost";

// Round schedule: pairs grow 4 -> 8, time shrinks 45s -> 15s (always under the
// 2:00 ceiling), easy terms for rounds 1-5, creative terms for rounds 6-10.
const START_PAIRS = 4;
const END_PAIRS = 8;
const START_SECONDS = 45;
const END_SECONDS = 15;
const TOTAL_HEARTS = 3;

interface Card {
  id: string;
  termName: string;
  label: string;
}

type Phase = "intro" | "playing" | "roundResult" | "gameOver";

function buildRound(terms: LexiconEntry[], roundIdx: number): { termCards: Card[]; meaningCards: Card[] } {
  const pairs = sizeForRound(roundIdx, START_PAIRS, END_PAIRS);
  const chosen = sample(terms, pairs);
  const termCards = shuffle(chosen.map((t) => ({ id: `term:${t.term}`, termName: t.term, label: t.term })));
  const meaningCards = shuffle(
    chosen.map((t) => ({ id: `meaning:${t.term}`, termName: t.term, label: t.plain })),
  );
  return { termCards, meaningCards };
}

interface TermMatchGameProps {
  terms: LexiconEntry[];
  founder: "Founder 55" | "Founder 88";
  categories: string[];
  onExit: () => void;
}

export function TermMatchGame({ terms, founder, categories, onExit }: TermMatchGameProps) {
  const { easy, creative } = useMemo(() => {
    const ranked = rankByDifficulty(terms);
    return splitByDifficulty(ranked);
  }, [terms]);

  const [phase, setPhase] = useState<Phase>("intro");
  const [roundIdx, setRoundIdx] = useState(0);
  const [termCards, setTermCards] = useState<Card[]>([]);
  const [meaningCards, setMeaningCards] = useState<Card[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<{ side: "term" | "meaning"; termName: string } | null>(null);
  const [wrongFlash, setWrongFlash] = useState<Set<string>>(new Set());
  const [hearts, setHearts] = useState(TOTAL_HEARTS);
  const [timeLeft, setTimeLeft] = useState(START_SECONDS);
  const [totalMatched, setTotalMatched] = useState(0);
  const [totalPairs, setTotalPairs] = useState(0);
  const [xp, setXp] = useState(0);
  const [xpFlash, setXpFlash] = useState(false);

  const [reportStatus, setReportStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [reportError, setReportError] = useState("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const roundPairs = termCards.length;

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => stopTimer, []);

  const startRound = (idx: number) => {
    const pool = idx < CREATIVE_SPLIT_ROUND ? easy : creative;
    const { termCards: tc, meaningCards: mc } = buildRound(pool, idx);
    setTermCards(tc);
    setMeaningCards(mc);
    setMatched(new Set());
    setSelected(null);
    setWrongFlash(new Set());
    setTimeLeft(timeForRound(idx, START_SECONDS, END_SECONDS));
    setTotalPairs((p) => p + tc.length);
    setPhase("playing");

    stopTimer();
    let remaining = timeForRound(idx, START_SECONDS, END_SECONDS);
    timerRef.current = setInterval(() => {
      remaining -= 0.25;
      if (remaining <= 0) {
        stopTimer();
        setTimeLeft(0);
        setPhase("roundResult");
      } else {
        setTimeLeft(remaining);
      }
    }, 250);
  };

  const beginGame = () => {
    setRoundIdx(0);
    setHearts(TOTAL_HEARTS);
    setTotalMatched(0);
    setTotalPairs(0);
    setXp(0);
    setReportStatus("idle");
    startRound(0);
  };

  const handleContinueFromResult = () => {
    if (hearts <= 0) {
      setPhase("gameOver");
      return;
    }
    const next = roundIdx + 1;
    if (next >= ROUND_COUNT) {
      setPhase("gameOver");
      return;
    }
    setRoundIdx(next);
    startRound(next);
  };

  const handlePick = (side: "term" | "meaning", card: Card) => {
    if (phase !== "playing" || matched.has(card.termName)) return;

    if (!selected) {
      setSelected({ side, termName: card.termName });
      return;
    }
    if (selected.side === side) {
      // Re-picking on the same side just changes the selection.
      setSelected({ side, termName: card.termName });
      return;
    }
    // Opposite side picked — check for a match.
    if (selected.termName === card.termName) {
      const next = new Set(matched);
      next.add(card.termName);
      setMatched(next);
      setSelected(null);
      setXp((x) => x + 10);
      setXpFlash(true);
      setTimeout(() => setXpFlash(false), 900);
      setTotalMatched((m) => m + 1);
      if (next.size >= termCards.length) {
        stopTimer();
        setPhase("roundResult");
      }
    } else {
      const flashIds = new Set([`${selected.side}:${selected.termName}`, `${side}:${card.termName}`]);
      setWrongFlash(flashIds);
      setSelected(null);
      const newHearts = hearts - 1;
      setHearts(newHearts);
      setTimeout(() => setWrongFlash(new Set()), 500);
      if (newHearts <= 0) {
        stopTimer();
        setTimeout(() => setPhase("roundResult"), 500);
      }
    }
  };

  const sendReport = async () => {
    setReportStatus("loading");
    setReportError("");
    try {
      const res = await fetch("/api/training/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          founder,
          score: totalMatched,
          total: totalPairs,
          categories,
          xp,
          mode: "Term Match",
          timestamp: new Date().toISOString(),
        }),
      });
      const json = await res.json();
      if (json.ok) setReportStatus("sent");
      else {
        setReportStatus("error");
        setReportError(json.error ?? "Unknown error.");
      }
    } catch (err) {
      setReportStatus("error");
      setReportError(err instanceof Error ? err.message : "Network error.");
    }
  };

  // ── Intro screen ─────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <div className="flex flex-col gap-8 pt-2 max-w-6xl">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="lg:hidden self-center">
            <ValeHost pose="quiz-welcome" className="w-28 h-40" priority />
          </div>
          <div className="flex-1 max-w-2xl flex flex-col gap-6">
            <button
              onClick={onExit}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-fg w-fit"
            >
              <ArrowLeft size={14} /> Back to training options
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gold">Term Match</h1>
              <p className="mt-2 text-sm text-subtle">
                Match each term to its plain-language meaning before the clock runs out. Ten
                rounds — the words get more creative and the timer gets tighter as you go.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-panel p-5 flex flex-col gap-2 text-sm text-subtle">
              <p>
                <span className="font-semibold text-fg">Rounds 1–5:</span> everyday HVN terms.
              </p>
              <p>
                <span className="font-semibold text-fg">Rounds 6–10:</span> the more creative,
                multi-word phrases.
              </p>
              <p>
                Each round gives you more pairs and less time — starting at {START_SECONDS}s,
                ending at {END_SECONDS}s. You have {TOTAL_HEARTS} hearts for the whole session.
              </p>
            </div>
            <button
              onClick={beginGame}
              disabled={terms.length < START_PAIRS}
              className="w-full rounded-xl border border-gold/60 bg-gold/10 py-3 text-sm font-semibold text-gold hover:bg-gold/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Start Round 1
            </button>
            {terms.length < START_PAIRS && (
              <p className="text-xs text-red-400">
                Select at least {START_PAIRS} terms&apos; worth of categories to play Term Match.
              </p>
            )}
          </div>
          <div className="hidden lg:block sticky top-6 w-[320px] xl:w-[420px] h-[75vh] shrink-0">
            <ValeHost pose="quiz-welcome" className="w-full h-full" priority />
          </div>
        </div>
      </div>
    );
  }

  // ── Game over screen ─────────────────────────────────────────────
  if (phase === "gameOver") {
    const pct = totalPairs > 0 ? Math.round((totalMatched / totalPairs) * 100) : 0;
    const passed = hearts > 0;
    return (
      <div className="flex flex-col gap-8 pt-2 max-w-6xl">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="lg:hidden self-center">
            <ValeHost pose="quiz-welcome" className="w-28 h-40" />
          </div>
          <div className="flex-1 max-w-2xl flex flex-col gap-8">
            <div>
              <h1 className="text-3xl font-bold text-gold">
                {passed ? "Vale Congratulates You" : "Session Complete"}
              </h1>
              <p className="mt-2 text-sm text-subtle">
                {passed
                  ? `Well done, ${founder} — you cleared Term Match.`
                  : `Here's how you did, ${founder}.`}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-panel p-6 flex flex-col gap-4">
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold text-gold">
                  {totalMatched}/{totalPairs}
                </span>
                <span className="text-xl text-subtle">{pct}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-subtle">XP Earned:</span>
                <span className="text-sm font-semibold text-gold">+{xp} XP</span>
              </div>
              <p className="text-xs text-muted">Reached round {Math.min(roundIdx + 1, ROUND_COUNT)}/{ROUND_COUNT}.</p>
              {!passed && <p className="text-sm text-red-400">Session ended early — all hearts lost.</p>}
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={sendReport}
                disabled={reportStatus === "loading" || reportStatus === "sent"}
                className="w-full rounded-xl border border-gold/40 bg-gold/10 py-3 text-sm font-semibold text-gold hover:bg-gold/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reportStatus === "loading" ? "Sending…" : reportStatus === "sent" ? "Report Sent" : "Send Score Report"}
              </button>
              {reportStatus === "error" && (
                <p className="text-xs text-red-400 text-center">
                  Failed to send report{reportError ? `: ${reportError}` : ""}.
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={beginGame}
                  className="flex-1 rounded-xl border border-border bg-panel py-3 text-sm font-medium text-fg hover:border-gold/40 hover:bg-panel-2 transition-all"
                >
                  Try Again
                </button>
                <button
                  onClick={onExit}
                  className="flex-1 rounded-xl border border-border bg-panel py-3 text-sm font-medium text-subtle hover:border-gold/40 hover:text-fg hover:bg-panel-2 transition-all"
                >
                  Back to Start
                </button>
              </div>
            </div>
          </div>
          <div
            className={[
              "hidden lg:block sticky top-6 shrink-0",
              passed ? "w-[360px] xl:w-[460px] h-[80vh]" : "w-[320px] xl:w-[420px] h-[70vh]",
            ].join(" ")}
          >
            <ValeHost pose="quiz-welcome" className="w-full h-full" />
          </div>
        </div>
      </div>
    );
  }

  // ── Round result screen ──────────────────────────────────────────
  if (phase === "roundResult") {
    const clearedRound = matched.size >= roundPairs;
    const outOfHearts = hearts <= 0;
    const isLastRound = roundIdx + 1 >= ROUND_COUNT;
    return (
      <div className="flex flex-col gap-6 pt-2 max-w-2xl">
        <div className="rounded-2xl border border-border bg-panel p-6 flex flex-col gap-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Round {roundIdx + 1}/{ROUND_COUNT}
          </p>
          <h2 className="text-2xl font-bold text-gold">
            {outOfHearts ? "Out of hearts" : clearedRound ? "Round cleared!" : "Time's up"}
          </h2>
          <p className="text-sm text-subtle">
            Matched {matched.size}/{roundPairs} pairs this round.
          </p>
          <button
            onClick={handleContinueFromResult}
            className="mt-2 w-full rounded-xl border border-gold/60 bg-gold/10 py-3 text-sm font-semibold text-gold hover:bg-gold/20 transition-all"
          >
            {outOfHearts || isLastRound ? "See Results" : `Continue to Round ${roundIdx + 2}`}
          </button>
        </div>
      </div>
    );
  }

  // ── Playing screen ────────────────────────────────────────────────
  const urgent = timeLeft <= 10;
  return (
    <div className="flex flex-col gap-6 pt-2 max-w-6xl">
      <div className="flex items-center gap-4">
        <span className="text-xs font-semibold text-muted whitespace-nowrap">
          Round {roundIdx + 1}/{ROUND_COUNT}
        </span>
        <div className="flex-1 h-2 rounded-full bg-border">
          <div
            className="h-2 rounded-full bg-gold transition-all duration-200"
            style={{ width: `${(matched.size / Math.max(1, roundPairs)) * 100}%` }}
          />
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: TOTAL_HEARTS }).map((_, i) => (
            <Heart key={i} size={18} className={i < hearts ? "text-gold fill-gold" : "text-border fill-border"} />
          ))}
        </div>
        <div className={["flex items-center gap-1 text-xs font-semibold whitespace-nowrap", urgent ? "text-red-400" : "text-muted"].join(" ")}>
          <Timer size={14} />
          {formatClock(timeLeft)}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="lg:hidden self-center">
          <ValeHost pose="stance" className="w-24 h-36" />
        </div>

        <div className="flex-1 max-w-2xl rounded-2xl border border-border bg-panel p-6 flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Match each term to its meaning</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              {termCards.map((c) => {
                const isMatched = matched.has(c.termName);
                const isSelected = selected?.side === "term" && selected.termName === c.termName;
                const isWrong = wrongFlash.has(`term:${c.termName}`);
                return (
                  <button
                    key={c.id}
                    onClick={() => handlePick("term", c)}
                    disabled={isMatched}
                    className={[
                      "rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all",
                      isMatched
                        ? "border-gold/30 bg-gold/5 text-muted opacity-50"
                        : isWrong
                        ? "border-red-500/60 bg-red-500/10 text-red-400"
                        : isSelected
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-border bg-panel text-fg hover:border-gold/40 hover:bg-panel-2",
                    ].join(" ")}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2">
              {meaningCards.map((c) => {
                const isMatched = matched.has(c.termName);
                const isSelected = selected?.side === "meaning" && selected.termName === c.termName;
                const isWrong = wrongFlash.has(`meaning:${c.termName}`);
                return (
                  <button
                    key={c.id}
                    onClick={() => handlePick("meaning", c)}
                    disabled={isMatched}
                    className={[
                      "rounded-xl border px-3 py-2.5 text-left text-sm transition-all",
                      isMatched
                        ? "border-gold/30 bg-gold/5 text-muted opacity-50"
                        : isWrong
                        ? "border-red-500/60 bg-red-500/10 text-red-400"
                        : isSelected
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-border bg-panel text-subtle hover:border-gold/40 hover:bg-panel-2",
                    ].join(" ")}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
          {xpFlash && <div className="text-center text-gold font-bold text-lg animate-bounce">+10 XP</div>}
        </div>

        <div className="hidden lg:block sticky top-6 w-[320px] xl:w-[400px] h-[70vh] shrink-0">
          <ValeHost pose="stance" className="w-full h-full" priority />
        </div>
      </div>
    </div>
  );
}

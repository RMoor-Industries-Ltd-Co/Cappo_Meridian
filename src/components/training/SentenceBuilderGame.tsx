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

// Round schedule: blanks grow 1 -> 3, word-bank distractors grow 2 -> 5, time
// shrinks 60s -> 15s (always under the 2:00 ceiling).
const START_BLANKS = 1;
const END_BLANKS = 3;
const START_DISTRACTORS = 2;
const END_DISTRACTORS = 5;
const START_SECONDS = 60;
const END_SECONDS = 15;
const TOTAL_HEARTS = 3;

const STOPWORDS = new Set([
  "the", "and", "with", "that", "this", "into", "from", "for", "are", "was",
  "were", "has", "have", "its", "not", "but", "you", "your", "our", "when",
  "then", "than", "too", "how", "who", "what", "where", "which", "while",
  "before", "after", "once", "only", "just", "also", "let", "can", "will",
  "would", "should", "could", "may", "might", "must", "shall", "being",
  "been", "their", "them", "they", "she", "him", "her", "his", "ours",
  "yours", "there", "here", "over", "under", "each", "does", "held",
  "left", "still", "another", "these", "those",
]);

function normalize(w: string): string {
  return w.replace(/[^a-zA-Z0-9'-]/g, "").toLowerCase();
}

interface Span {
  startIdx: number;
  length: number;
  correctAnswer: string;
}

function findPhraseIndices(words: string[], phrase: string): number[] | null {
  const phraseWords = phrase.trim().split(/\s+/).map(normalize);
  for (let i = 0; i <= words.length - phraseWords.length; i++) {
    let ok = true;
    for (let j = 0; j < phraseWords.length; j++) {
      if (normalize(words[i + j]) !== phraseWords[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return Array.from({ length: phraseWords.length }, (_, k) => i + k);
  }
  return null;
}

interface RoundData {
  term: LexiconEntry;
  words: string[];
  spans: Span[]; // ordered left-to-right; each is one blank/slot
}

function buildRoundData(term: LexiconEntry, blanksNeeded: number): RoundData {
  const words = term.example.trim().split(/\s+/);
  const spans: Span[] = [];
  const usedIdx = new Set<number>();

  const phraseIdx = findPhraseIndices(words, term.term);
  if (phraseIdx) {
    spans.push({ startIdx: phraseIdx[0], length: phraseIdx.length, correctAnswer: term.term });
    phraseIdx.forEach((i) => usedIdx.add(i));
  }

  const remainingNeeded = blanksNeeded - spans.length;
  if (remainingNeeded > 0) {
    const candidates = words
      .map((w, i) => ({ w, i }))
      .filter(({ w, i }) => !usedIdx.has(i) && normalize(w).length >= 4 && !STOPWORDS.has(normalize(w)));
    const chosen = sample(candidates, remainingNeeded);
    for (const { w, i } of chosen) {
      spans.push({ startIdx: i, length: 1, correctAnswer: w.replace(/[^a-zA-Z0-9'-]/g, "") });
      usedIdx.add(i);
    }
  }

  spans.sort((a, b) => a.startIdx - b.startIdx);
  return { term, words, spans };
}

/** Pool of candidate distractor words/phrases drawn from the whole selected term set. */
function buildDistractorPool(terms: LexiconEntry[]): string[] {
  const seen = new Map<string, string>(); // normalized -> display
  for (const t of terms) {
    seen.set(normalize(t.term), t.term);
    for (const src of [t.plain, t.example]) {
      for (const raw of src.split(/\s+/)) {
        const clean = raw.replace(/[^a-zA-Z0-9'-]/g, "");
        const norm = normalize(clean);
        if (norm.length >= 4 && !STOPWORDS.has(norm) && !seen.has(norm)) {
          seen.set(norm, clean);
        }
      }
    }
  }
  return Array.from(seen.values());
}

interface BankWord {
  id: string;
  label: string;
}

type Phase = "intro" | "playing" | "roundResult" | "gameOver";

interface SentenceBuilderGameProps {
  terms: LexiconEntry[];
  founder: string;
  categories: string[];
  onExit: () => void;
}

export function SentenceBuilderGame({ terms, founder, categories, onExit }: SentenceBuilderGameProps) {
  const { easy, creative } = useMemo(() => {
    const ranked = rankByDifficulty(terms.filter((t) => t.example.trim().length > 0));
    return splitByDifficulty(ranked);
  }, [terms]);

  const distractorPool = useMemo(() => buildDistractorPool(terms), [terms]);

  const [phase, setPhase] = useState<Phase>("intro");
  const [roundIdx, setRoundIdx] = useState(0);
  const [round, setRound] = useState<RoundData | null>(null);
  const [bank, setBank] = useState<BankWord[]>([]);
  const [placement, setPlacement] = useState<(string | null)[]>([]);
  const [usedBankIds, setUsedBankIds] = useState<Set<string>>(new Set());
  const [slotResults, setSlotResults] = useState<boolean[] | null>(null);
  const [hearts, setHearts] = useState(TOTAL_HEARTS);
  const [timeLeft, setTimeLeft] = useState(START_SECONDS);
  const [totalCorrectRounds, setTotalCorrectRounds] = useState(0);
  const [roundsPlayed, setRoundsPlayed] = useState(0);
  const [xp, setXp] = useState(0);
  const [xpFlash, setXpFlash] = useState(false);

  const [reportStatus, setReportStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [reportError, setReportError] = useState("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Kept in sync with state so the interval callback (a stable closure set up
  // once per round) always reads the latest placement when time runs out.
  const placementRef = useRef<(string | null)[]>([]);
  const bankRef = useRef<BankWord[]>([]);
  const roundRef = useRef<RoundData | null>(null);

  useEffect(() => {
    placementRef.current = placement;
  }, [placement]);
  useEffect(() => {
    bankRef.current = bank;
  }, [bank]);
  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => stopTimer, []);

  const evaluate = (finalPlacement: (string | null)[], bankList: BankWord[], spans: Span[]) => {
    const results = spans.map((span, idx) => {
      const id = finalPlacement[idx];
      if (!id) return false;
      const word = bankList.find((b) => b.id === id);
      return !!word && normalize(word.label) === normalize(span.correctAnswer);
    });
    stopTimer();
    setSlotResults(results);
    setRoundsPlayed((n) => n + 1);
    const allCorrect = results.every(Boolean);
    if (allCorrect) {
      setTotalCorrectRounds((n) => n + 1);
      setXp((x) => x + 15);
      setXpFlash(true);
      setTimeout(() => setXpFlash(false), 900);
      setPhase("roundResult");
    } else {
      const newHearts = hearts - 1;
      setHearts(newHearts);
      setPhase("roundResult");
    }
  };

  const startRound = (idx: number) => {
    const pool = idx < CREATIVE_SPLIT_ROUND ? easy : creative;
    const term = sample(pool, 1)[0];
    if (!term) return;
    const blanksNeeded = sizeForRound(idx, START_BLANKS, END_BLANKS);
    const data = buildRoundData(term, blanksNeeded);

    const correctLabels = data.spans.map((s) => s.correctAnswer);
    const extraCount = sizeForRound(idx, START_DISTRACTORS, END_DISTRACTORS);
    const distractors = sample(
      distractorPool.filter((w) => !correctLabels.some((c) => normalize(c) === normalize(w))),
      extraCount,
    );
    const bankWords: BankWord[] = shuffle([
      ...correctLabels.map((label, i) => ({ id: `correct:${i}:${label}`, label })),
      ...distractors.map((label, i) => ({ id: `distractor:${i}:${label}`, label })),
    ]);

    setRound(data);
    setBank(bankWords);
    setPlacement(new Array(data.spans.length).fill(null));
    setUsedBankIds(new Set());
    setSlotResults(null);
    setTimeLeft(timeForRound(idx, START_SECONDS, END_SECONDS));
    setPhase("playing");

    stopTimer();
    let remaining = timeForRound(idx, START_SECONDS, END_SECONDS);
    timerRef.current = setInterval(() => {
      remaining -= 0.25;
      if (remaining <= 0) {
        stopTimer();
        setTimeLeft(0);
        // Auto-submit whatever is filled in — read from refs so this
        // (stable, round-scoped) interval callback sees the latest state.
        const currentRound = roundRef.current;
        if (currentRound) evaluate(placementRef.current, bankRef.current, currentRound.spans);
      } else {
        setTimeLeft(remaining);
      }
    }, 250);
  };

  const beginGame = () => {
    setRoundIdx(0);
    setHearts(TOTAL_HEARTS);
    setTotalCorrectRounds(0);
    setRoundsPlayed(0);
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

  const handleBankClick = (word: BankWord) => {
    if (phase !== "playing" || usedBankIds.has(word.id)) return;
    const emptyIdx = placement.findIndex((p) => p === null);
    if (emptyIdx === -1) return;
    const nextPlacement = [...placement];
    nextPlacement[emptyIdx] = word.id;
    setPlacement(nextPlacement);
    setUsedBankIds((prev) => new Set(prev).add(word.id));
  };

  const handleSlotClick = (idx: number) => {
    if (phase !== "playing") return;
    const id = placement[idx];
    if (!id) return;
    const nextPlacement = [...placement];
    nextPlacement[idx] = null;
    setPlacement(nextPlacement);
    setUsedBankIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleCheck = () => {
    if (!round || placement.some((p) => p === null)) return;
    evaluate(placement, bank, round.spans);
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
          score: totalCorrectRounds,
          total: roundsPlayed,
          categories,
          xp,
          mode: "Sentence Builder",
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
    const eligible = terms.filter((t) => t.example.trim().length > 0);
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
              <h1 className="text-3xl font-bold text-gold">Sentence Builder</h1>
              <p className="mt-2 text-sm text-subtle">
                A real HVN example sentence loses a few words. Pick from the word bank to fill
                the blanks and rebuild it — more blanks and less time each round.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-panel p-5 flex flex-col gap-2 text-sm text-subtle">
              <p>
                <span className="font-semibold text-fg">Rounds 1–5:</span> everyday terms, one
                blank at a time.
              </p>
              <p>
                <span className="font-semibold text-fg">Rounds 6–10:</span> creative phrases,
                up to {END_BLANKS} blanks and a bigger word bank.
              </p>
              <p>
                Time shrinks from {START_SECONDS}s down to {END_SECONDS}s. You have{" "}
                {TOTAL_HEARTS} hearts for the whole session.
              </p>
            </div>
            <button
              onClick={beginGame}
              disabled={eligible.length < 1}
              className="w-full rounded-xl border border-gold/60 bg-gold/10 py-3 text-sm font-semibold text-gold hover:bg-gold/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Start Round 1
            </button>
            {eligible.length < 1 && (
              <p className="text-xs text-red-400">
                Select categories with example sentences to play Sentence Builder.
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
    const pct = roundsPlayed > 0 ? Math.round((totalCorrectRounds / roundsPlayed) * 100) : 0;
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
                  ? `Well done, ${founder} — you cleared Sentence Builder.`
                  : `Here's how you did, ${founder}.`}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-panel p-6 flex flex-col gap-4">
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold text-gold">
                  {totalCorrectRounds}/{roundsPlayed}
                </span>
                <span className="text-xl text-subtle">{pct}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-subtle">XP Earned:</span>
                <span className="text-sm font-semibold text-gold">+{xp} XP</span>
              </div>
              <p className="text-xs text-muted">
                Reached round {Math.min(roundIdx + 1, ROUND_COUNT)}/{ROUND_COUNT}.
              </p>
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
  if (phase === "roundResult" && round && slotResults) {
    const allCorrect = slotResults.every(Boolean);
    const isLastRound = roundIdx + 1 >= ROUND_COUNT;
    const outOfHearts = hearts <= 0;
    return (
      <div className="flex flex-col gap-6 pt-2 max-w-2xl">
        <div className="rounded-2xl border border-border bg-panel p-6 flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted text-center">
            Round {roundIdx + 1}/{ROUND_COUNT}
          </p>
          <h2 className="text-2xl font-bold text-gold text-center">
            {allCorrect ? "Sentence rebuilt!" : "Not quite"}
          </h2>
          <p className="text-sm leading-relaxed text-fg">
            {round.words.map((w, i) => {
              const spanIdx = round.spans.findIndex((s) => s.startIdx === i);
              if (spanIdx === -1) {
                const inSpan = round.spans.some((s) => i > s.startIdx && i < s.startIdx + s.length);
                return inSpan ? null : <span key={i}>{w} </span>;
              }
              const span = round.spans[spanIdx];
              const correct = slotResults[spanIdx];
              return (
                <span
                  key={i}
                  className={correct ? "font-semibold text-gold" : "font-semibold text-red-400 underline"}
                >
                  {span.correctAnswer}{" "}
                </span>
              );
            })}
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
  if (!round) return null;
  const urgent = timeLeft <= 8;
  const allFilled = placement.every((p) => p !== null);

  return (
    <div className="flex flex-col gap-6 pt-2 max-w-6xl">
      <div className="flex items-center gap-4">
        <span className="text-xs font-semibold text-muted whitespace-nowrap">
          Round {roundIdx + 1}/{ROUND_COUNT}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          {Array.from({ length: TOTAL_HEARTS }).map((_, i) => (
            <Heart key={i} size={18} className={i < hearts ? "text-gold fill-gold" : "text-border fill-border"} />
          ))}
        </div>
        <div
          className={["flex items-center gap-1 text-xs font-semibold whitespace-nowrap", urgent ? "text-red-400" : "text-muted"].join(
            " ",
          )}
        >
          <Timer size={14} />
          {formatClock(timeLeft)}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="lg:hidden self-center">
          <ValeHost pose="stance" className="w-24 h-36" />
        </div>

        <div className="flex-1 max-w-2xl rounded-2xl border border-border bg-panel p-6 flex flex-col gap-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Fill in the blanks — {round.term.term}
          </p>
          <p className="text-lg leading-relaxed text-fg">
            {round.words.map((w, i) => {
              const spanIdx = round.spans.findIndex((s) => s.startIdx === i);
              if (spanIdx === -1) {
                const inSpan = round.spans.some((s) => i > s.startIdx && i < s.startIdx + s.length);
                return inSpan ? null : <span key={i}>{w} </span>;
              }
              const id = placement[spanIdx];
              const word = id ? bank.find((b) => b.id === id) : null;
              return (
                <button
                  key={i}
                  onClick={() => handleSlotClick(spanIdx)}
                  className={[
                    "inline-block mx-1 rounded-lg border px-2 py-0.5 text-sm font-semibold align-baseline transition-all",
                    word
                      ? "border-gold/60 bg-gold/10 text-gold"
                      : "border-dashed border-gold/40 text-muted",
                  ].join(" ")}
                >
                  {word ? word.label : `(${spanIdx + 1})`}
                </button>
              );
            })}
          </p>

          <div className="flex flex-wrap gap-2">
            {bank.map((word) => {
              const used = usedBankIds.has(word.id);
              return (
                <button
                  key={word.id}
                  onClick={() => handleBankClick(word)}
                  disabled={used}
                  className={[
                    "rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
                    used
                      ? "border-border bg-panel-2 text-muted opacity-40 cursor-default"
                      : "border-border bg-panel text-fg hover:border-gold/40 hover:bg-panel-2",
                  ].join(" ")}
                >
                  {word.label}
                </button>
              );
            })}
          </div>

          {xpFlash && <div className="text-center text-gold font-bold text-lg animate-bounce">+15 XP</div>}

          <button
            onClick={handleCheck}
            disabled={!allFilled}
            className="w-full rounded-xl border border-gold/60 bg-gold/10 py-3 text-sm font-semibold text-gold hover:bg-gold/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Check
          </button>
        </div>

        <div className="hidden lg:block sticky top-6 w-[320px] xl:w-[400px] h-[70vh] shrink-0">
          <ValeHost pose="stance" className="w-full h-full" priority />
        </div>
      </div>
    </div>
  );
}

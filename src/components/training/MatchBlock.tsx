"use client";

import { useState } from "react";
import { rnd, type MatchPair } from "@/lib/training-quiz";

interface MatchBlockProps {
  pairs: MatchPair[];
  /** True once the session can no longer accept answers (out of hearts). */
  locked: boolean;
  onPairMatched: (term: string) => void;
  onMiss: (term: string) => void;
  /** Fired once every pair is matched, with how many wrong picks it took. */
  onComplete: (misses: number) => void;
}

/**
 * A compact matching round used inside the Master Quiz. Same rules as the standalone Word
 * Match screen: pick a term, then its meaning; a wrong pick costs a heart, a right one locks in.
 * Remount per question (key it) — its selection state is local.
 */
export function MatchBlock({ pairs, locked, onPairMatched, onMiss, onComplete }: MatchBlockProps) {
  const [meanings] = useState(() => [...pairs].sort(rnd));
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [misses, setMisses] = useState(0);
  const [feedback, setFeedback] = useState("");

  const pick = (plain: string) => {
    if (locked || !selectedTerm || matched.has(plain)) return;
    const pair = pairs.find((p) => p.term === selectedTerm);
    if (!pair) return;

    if (pair.plain === plain) {
      const next = new Set(matched);
      next.add(plain);
      setMatched(next);
      setFeedback(`${pair.term} matched.`);
      setSelectedTerm(null);
      onPairMatched(pair.term);
      if (next.size >= pairs.length) onComplete(misses);
      return;
    }
    setMisses((m) => m + 1);
    setFeedback(`Not quite. ${pair.term} means ${pair.plain}.`);
    setSelectedTerm(null);
    onMiss(pair.term);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Terms</p>
          {pairs.map((pair) => {
            const done = matched.has(pair.plain);
            const active = selectedTerm === pair.term;
            return (
              <button
                key={pair.term}
                onClick={() => !done && !locked && setSelectedTerm(pair.term)}
                disabled={done || locked}
                className={[
                  "rounded-xl border px-4 py-3 text-left text-sm transition-all",
                  done
                    ? "border-gold/30 bg-gold/5 text-gold opacity-70"
                    : active
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-border bg-panel-2 text-fg hover:border-gold/40",
                ].join(" ")}
              >
                <span className="font-semibold">{pair.term}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Meanings</p>
          {meanings.map((pair) => {
            const done = matched.has(pair.plain);
            return (
              <button
                key={pair.plain}
                onClick={() => pick(pair.plain)}
                disabled={done || locked || !selectedTerm}
                className={[
                  "rounded-xl border px-4 py-3 text-left text-sm transition-all",
                  done
                    ? "border-gold/30 bg-gold/5 text-gold opacity-70"
                    : selectedTerm
                    ? "border-border bg-panel-2 text-fg hover:border-gold/40"
                    : "border-border bg-panel text-muted opacity-70",
                ].join(" ")}
              >
                {pair.plain}
              </button>
            );
          })}
        </div>
      </div>
      {feedback && !feedback.includes("matched") && (
        <p className="text-xs text-red-400">{feedback}</p>
      )}
    </div>
  );
}

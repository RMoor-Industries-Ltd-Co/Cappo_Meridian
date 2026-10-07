"use client";

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { TrainingGameProps } from "@/lib/training/registry";
import { QUICK_QUIZ_QUESTION_COUNT, QUICK_QUIZ_XP_PER_CORRECT } from "@/lib/training/config";
import { shuffle } from "@/lib/training/shuffle";
import { Results } from "../Results";

export function QuickQuiz({ terms, founder, categories, onExit }: TrainingGameProps) {
  const [screen, setScreen] = useState<"playing" | "results">("playing");
  const [questions, setQuestions] = useState(() => shuffle(terms).slice(0, Math.min(QUICK_QUIZ_QUESTION_COUNT, terms.length)));
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const current = questions[index];
  const options = useMemo(
    () =>
      current
        ? shuffle([
            current.plain,
            ...shuffle(terms.filter((term) => term.term !== current.term)).slice(0, 3).map((term) => term.plain),
          ])
        : [],
    [current, terms],
  );

  if (screen === "results") {
    return (
      <Results
        founder={founder}
        mode="Quick Quiz"
        categories={categories}
        summary={{ score, total: questions.length, xp: score * QUICK_QUIZ_XP_PER_CORRECT }}
        onRestart={() => {
          setQuestions(shuffle(terms).slice(0, Math.min(QUICK_QUIZ_QUESTION_COUNT, terms.length)));
          setIndex(0);
          setScore(0);
          setScreen("playing");
        }}
        onExit={onExit}
      />
    );
  }
  if (!current) return null;

  return (
    <div className="max-w-2xl pt-2 flex flex-col gap-6">
      <button onClick={onExit} className="flex items-center gap-2 text-xs text-muted">
        <ArrowLeft size={14} /> Training menu
      </button>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted">Question {index + 1}/{questions.length}</p>
        <h1 className="mt-2 text-3xl font-bold text-gold">{current.term}</h1>
        <p className="mt-2 text-sm text-subtle">Choose the real-world meaning.</p>
      </div>
      <div className="grid gap-3">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => {
              if (option === current.plain) setScore((value) => value + 1);
              if (index + 1 === questions.length) setScreen("results");
              else setIndex((value) => value + 1);
            }}
            className="rounded-xl border border-border bg-panel p-4 text-left text-sm text-fg hover:border-gold/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

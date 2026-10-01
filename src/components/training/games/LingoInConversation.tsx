"use client";

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { TrainingGameProps } from "@/lib/training/registry";
import {
  buildSentencePool,
  maskSentence,
  selectSentencesForDifficulty,
  type LexiconSentenceExample,
} from "@/lib/training/sentenceCorpus";
import { CONVERSATION_DISTRACTORS_BY_DIFFICULTY, SENTENCE_XP_PER_CORRECT } from "@/lib/training/config";
import { shuffle } from "@/lib/training/shuffle";

const SESSION_LENGTH = 8;

function tierForIndex(index: number): number {
  // Ramps 1 -> 5 across the session, then holds at 5 for any remaining prompts.
  return Math.min(5, Math.floor(index / 2) + 1);
}

interface BankWord {
  id: string;
  label: string;
}

export function LingoInConversation({ terms, onExit }: TrainingGameProps) {
  const pool = useMemo(() => buildSentencePool(terms), [terms]);
  const [session] = useState<LexiconSentenceExample[]>(() => {
    const picks: LexiconSentenceExample[] = [];
    const used = new Set<string>();
    for (let i = 0; i < SESSION_LENGTH; i += 1) {
      const tier = tierForIndex(i);
      const targetDifficulty = tier * 2;
      const candidates = pool.filter((s) => !used.has(s.id));
      const [choice] = selectSentencesForDifficulty(candidates.length ? candidates : pool, targetDifficulty, 1);
      if (!choice) break;
      used.add(choice.id);
      picks.push(choice);
    }
    return picks;
  });
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  if (session.length === 0) {
    return (
      <div className="max-w-2xl pt-2 flex flex-col gap-4">
        <button onClick={onExit} className="flex items-center gap-2 text-xs text-muted">
          <ArrowLeft size={14} /> Training menu
        </button>
        <p className="text-sm text-subtle">Select categories with example sentences to play Lingo in Conversation.</p>
      </div>
    );
  }

  if (done) {
    const percent = Math.round((correctCount / session.length) * 100);
    return (
      <div className="max-w-2xl pt-2 flex flex-col gap-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Lingo in Conversation</p>
          <h1 className="mt-2 text-3xl font-bold text-gold">Session complete</h1>
        </div>
        <div className="rounded-2xl border border-border bg-panel p-6">
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-bold text-gold">{correctCount}/{session.length}</span>
            <span className="text-xl text-subtle">{percent}%</span>
          </div>
          <p className="mt-3 text-sm text-subtle">XP earned: <span className="font-semibold text-gold">+{correctCount * SENTENCE_XP_PER_CORRECT}</span></p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => window.location.reload()} className="flex-1 rounded-xl border border-border bg-panel py-3 text-sm text-fg">Try again</button>
          <button onClick={onExit} className="flex-1 rounded-xl border border-border bg-panel py-3 text-sm text-subtle">Training menu</button>
        </div>
      </div>
    );
  }

  const sentence = session[index];
  return (
    <div className="max-w-3xl pt-2 flex flex-col gap-5">
      <button onClick={onExit} className="flex items-center gap-2 text-xs text-muted">
        <ArrowLeft size={14} /> Training menu
      </button>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Prompt {index + 1}/{session.length}</p>
          <h2 className="text-2xl font-bold text-gold">Lingo in Conversation</h2>
        </div>
        <span className="text-xs text-subtle capitalize">{sentence.kind.replace(/-/g, " ")}</span>
      </div>
      <SentenceCard
        key={sentence.id}
        sentence={sentence}
        terms={terms}
        onSubmit={(correct) => {
          if (correct) setCorrectCount((value) => value + 1);
          if (index + 1 >= session.length) setDone(true);
          else setIndex((value) => value + 1);
        }}
      />
    </div>
  );
}

function SentenceCard({
  sentence,
  terms,
  onSubmit,
}: {
  sentence: LexiconSentenceExample;
  terms: TrainingGameProps["terms"];
  onSubmit: (correct: boolean) => void;
}) {
  const masked = useMemo(() => maskSentence(sentence), [sentence]);
  const parts = masked.split(/(\{\{\d+\}\})/g);
  const orderedTerms = useMemo(() => [...sentence.terms].sort((a, b) => b.length - a.length), [sentence]);

  const bank = useMemo<BankWord[]>(() => {
    const distractorCount = CONVERSATION_DISTRACTORS_BY_DIFFICULTY[Math.min(5, Math.max(1, Math.ceil(sentence.difficulty / 2)))] ?? 3;
    const distractors = shuffle(terms.filter((t) => !sentence.terms.includes(t.term)))
      .slice(0, distractorCount)
      .map((t) => t.term);
    return shuffle([
      ...orderedTerms.map((label, i) => ({ id: `correct:${i}:${label}`, label })),
      ...distractors.map((label, i) => ({ id: `distractor:${i}:${label}`, label })),
    ]);
  }, [orderedTerms, sentence, terms]);

  const [placements, setPlacements] = useState<Array<string | null>>(() => orderedTerms.map(() => null));
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState(false);

  const place = (word: BankWord) => {
    if (checked || usedIds.has(word.id)) return;
    const slot = placements.findIndex((value) => value === null);
    if (slot === -1) return;
    setPlacements((current) => current.map((value, i) => (i === slot ? word.id : value)));
    setUsedIds((current) => new Set(current).add(word.id));
  };

  const clearSlot = (slot: number) => {
    if (checked) return;
    const id = placements[slot];
    if (!id) return;
    setPlacements((current) => current.map((value, i) => (i === slot ? null : value)));
    setUsedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const allFilled = placements.every((value) => value !== null);
  const results = checked
    ? placements.map((id, i) => bank.find((w) => w.id === id)?.label === orderedTerms[i])
    : null;

  return (
    <div className="rounded-2xl border border-border bg-panel p-6 flex flex-col gap-5">
      <p className="text-lg leading-relaxed text-fg">
        {parts.map((part, i) => {
          const match = part.match(/^\{\{(\d+)\}\}$/);
          if (!match) return <span key={i}>{part}</span>;
          const slot = Number(match[1]);
          const id = placements[slot];
          const label = id ? bank.find((w) => w.id === id)?.label : null;
          const correctness = results?.[slot];
          return (
            <button
              key={i}
              onClick={() => clearSlot(slot)}
              disabled={checked}
              className={[
                "inline-block mx-1 rounded-lg border px-2 py-0.5 text-sm font-semibold align-baseline",
                checked
                  ? correctness
                    ? "border-gold/60 bg-gold/10 text-gold"
                    : "border-red-500/60 bg-red-500/10 text-red-400"
                  : label
                    ? "border-gold/60 bg-gold/10 text-gold"
                    : "border-dashed border-gold/40 text-muted",
              ].join(" ")}
            >
              {label ?? `(${slot + 1})`}
            </button>
          );
        })}
      </p>
      <div className="flex flex-wrap gap-2">
        {bank.map((word) => {
          const used = usedIds.has(word.id);
          return (
            <button
              key={word.id}
              onClick={() => place(word)}
              disabled={used || checked}
              className={[
                "rounded-lg border px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold",
                used ? "border-border bg-panel-2 text-muted opacity-40" : "border-border bg-panel text-fg hover:border-gold/40",
              ].join(" ")}
            >
              {word.label}
            </button>
          );
        })}
      </div>
      {checked ? (
        <button
          onClick={() => onSubmit(results?.every(Boolean) ?? false)}
          className="w-full rounded-xl border border-gold/60 bg-gold/10 py-3 text-sm font-semibold text-gold"
        >
          Continue
        </button>
      ) : (
        <button
          onClick={() => setChecked(true)}
          disabled={!allFilled}
          className="w-full rounded-xl border border-gold/60 bg-gold/10 py-3 text-sm font-semibold text-gold disabled:opacity-40"
        >
          Check
        </button>
      )}
    </div>
  );
}

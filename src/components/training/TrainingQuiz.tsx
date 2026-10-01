"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";
import type { LexiconEntry } from "@/lib/lexicon-data";
import { listTrainingGames, type TrainingMode } from "@/lib/training/registry";
import "./registerGames";
import { ValeHost } from "./ValeHost";

type Founder = "Founder 55" | "Founder 88";

interface TrainingQuizProps {
  terms: LexiconEntry[];
  categories: string[];
}

export function TrainingQuiz({ terms, categories }: TrainingQuizProps) {
  const [founder, setFounder] = useState<Founder>("Founder 55");
  const [selectedCategories, setSelectedCategories] = useState(new Set(categories));
  const [mode, setMode] = useState<TrainingMode | null>(null);
  const selectedTerms = terms.filter((term) => selectedCategories.has(term.category));
  const selected = Array.from(selectedCategories);
  const toggle = (category: string) =>
    setSelectedCategories((current) => {
      const next = new Set(current);
      if (next.has(category) && next.size > 1) next.delete(category);
      else next.add(category);
      return next;
    });

  const games = listTrainingGames();
  const active = mode ? games.find((g) => g.mode === mode) : null;

  if (active && active.status !== "locked") {
    const Game = active.component;
    return <Game terms={selectedTerms} founder={founder} categories={selected} onExit={() => setMode(null)} />;
  }

  return (
    <div className="max-w-6xl pt-2 flex flex-col gap-8">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="flex-1 max-w-3xl flex flex-col gap-8">
          <div>
            <h1 className="text-3xl font-bold text-gold">Training</h1>
            <p className="mt-2 text-sm text-subtle">Choose a founder, a training format, and the Lexicon categories to practice.</p>
          </div>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Who&apos;s training?</h2>
            <div className="flex gap-3">
              {(["Founder 55", "Founder 88"] as Founder[]).map((value) => (
                <button
                  key={value}
                  onClick={() => setFounder(value)}
                  className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium ${
                    founder === value ? "border-gold bg-gold/10 text-gold" : "border-border bg-panel text-subtle"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Choose your training</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {games.map((game) => {
                const disabled = game.status === "locked" || selectedTerms.length < game.minTerms;
                return (
                  <button
                    key={game.mode}
                    onClick={() => game.status !== "locked" && setMode(game.mode)}
                    disabled={disabled}
                    className="rounded-2xl border border-border bg-panel p-5 text-left hover:border-gold/50 disabled:opacity-40 disabled:hover:border-border"
                  >
                    <div className="flex items-center gap-2 text-gold">
                      <CheckCircle size={16} />
                      <span className="font-semibold">{game.title}</span>
                      {game.status !== "playable" && (
                        <span className="rounded-full border border-gold/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold">
                          {game.status === "locked" ? "Coming soon" : "Preview"}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-subtle">{game.description}</p>
                    {game.statusNote && <p className="mt-2 text-xs leading-relaxed text-muted">{game.statusNote}</p>}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Categories</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => toggle(category)}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    selectedCategories.has(category) ? "border-gold/60 bg-gold/10 text-gold" : "border-border bg-panel text-subtle"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">{selectedTerms.length} controlled terms selected</p>
          </section>
        </div>
        <div className="hidden lg:block sticky top-6 w-[360px] h-[75vh] shrink-0">
          <ValeHost pose="quiz-welcome" className="w-full h-full" priority />
        </div>
      </div>
    </div>
  );
}

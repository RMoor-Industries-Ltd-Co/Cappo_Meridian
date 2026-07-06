"use client";

import { useState, useCallback } from "react";
import { Heart, CheckCircle } from "lucide-react";
import type { LexiconEntry } from "@/lib/lexicon-data";
import { ValeHost } from "./ValeHost";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Question {
  mode: "a" | "b";
  term: LexiconEntry;
  correct: string;
  options: string[];
}

type Screen = "start" | "quiz" | "results";

// ─── Question generator ───────────────────────────────────────────────────────

function generateQuestions(terms: LexiconEntry[], count = 10): Question[] {
  const shuffled = [...terms].sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled.map((term) => {
    const mode: "a" | "b" = Math.random() > 0.5 ? "a" : "b";
    const correct = mode === "a" ? term.plain : term.term;
    const pool = terms.filter((t) => t.term !== term.term);
    const wrong = pool
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((t) => (mode === "a" ? t.plain : t.term));
    const options = [...wrong, correct].sort(() => Math.random() - 0.5);
    return { mode, term, correct, options };
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

interface TrainingQuizProps {
  terms: LexiconEntry[];
  categories: string[];
}

export function TrainingQuiz({ terms: LEXICON_TERMS, categories: CATEGORIES }: TrainingQuizProps) {
  // Start screen state
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(CATEGORIES));
  const [founder, setFounder] = useState<"Founder 55" | "Founder 88">("Founder 55");

  // Quiz state
  const [screen, setScreen] = useState<Screen>("start");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [xp, setXp] = useState(0);
  const [xpFlash, setXpFlash] = useState(false);

  // Add term state
  const [addTermInput, setAddTermInput] = useState("");
  const [addTermStatus, setAddTermStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [addTermMessage, setAddTermMessage] = useState("");

  // Score report state
  const [reportStatus, setReportStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [reportError, setReportError] = useState("");

  const currentQuestion = questions[currentIdx];
  const totalQuestions = questions.length;

  // ── Toggle category ──────────────────────────────────────────────
  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        if (next.size > 1) next.delete(cat); // keep at least one
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  // ── Begin session ────────────────────────────────────────────────
  const beginSession = () => {
    const pool = LEXICON_TERMS.filter((t) => selectedCategories.has(t.category));
    if (pool.length < 2) return; // not enough terms
    const qs = generateQuestions(pool, Math.min(10, pool.length));
    setQuestions(qs);
    setCurrentIdx(0);
    setScore(0);
    setLives(3);
    setXp(0);
    setSelected(null);
    setAnswered(false);
    setScreen("quiz");
    setReportStatus("idle");
  };

  // ── Handle answer ────────────────────────────────────────────────
  const handleAnswer = useCallback(
    (option: string) => {
      if (answered || !currentQuestion) return;
      setSelected(option);
      setAnswered(true);

      if (option === currentQuestion.correct) {
        setScore((s) => s + 1);
        setXp((x) => x + 10);
        setXpFlash(true);
        setTimeout(() => setXpFlash(false), 1200);
      } else {
        const newLives = lives - 1;
        setLives(newLives);
        if (newLives === 0) {
          // out of lives — go to results after delay
          setTimeout(() => setScreen("results"), 1500);
          return;
        }
      }
    },
    [answered, currentQuestion, lives],
  );

  // ── Continue ─────────────────────────────────────────────────────
  const handleContinue = () => {
    if (currentIdx + 1 >= totalQuestions) {
      setScreen("results");
    } else {
      setCurrentIdx((i) => i + 1);
      setSelected(null);
      setAnswered(false);
    }
  };

  // ── Send score report ────────────────────────────────────────────
  const sendReport = async () => {
    setReportStatus("loading");
    setReportError("");
    try {
      const res = await fetch("/api/training/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          founder,
          score,
          total: totalQuestions,
          categories: Array.from(selectedCategories),
          xp,
          timestamp: new Date().toISOString(),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setReportStatus("sent");
      } else {
        setReportStatus("error");
        setReportError(json.error ?? "Unknown error.");
      }
    } catch (err) {
      setReportStatus("error");
      setReportError(err instanceof Error ? err.message : "Network error.");
    }
  };

  // ── Submit add-term ──────────────────────────────────────────────
  const submitAddTerm = async () => {
    if (!addTermInput.trim()) return;
    setAddTermStatus("loading");
    setAddTermMessage("");
    try {
      const res = await fetch("/api/training/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: addTermInput.trim() }),
      });
      const json = await res.json();
      if (json.ok) {
        setAddTermStatus("success");
        setAddTermMessage(`"${json.term}" added to the Notion lexicon.`);
        setAddTermInput("");
      } else {
        setAddTermStatus("error");
        setAddTermMessage(json.error ?? "Something went wrong.");
      }
    } catch {
      setAddTermStatus("error");
      setAddTermMessage("Network error. Please try again.");
    }
  };

  // ── Render: Start screen ─────────────────────────────────────────
  if (screen === "start") {
    return (
      <div className="flex flex-col gap-8 pt-2 max-w-6xl">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Vale — mobile: small, above content */}
          <div className="lg:hidden self-center">
            <ValeHost pose="quiz-welcome" className="w-28 h-40" priority />
          </div>

          {/* Left content column */}
          <div className="flex-1 max-w-2xl flex flex-col gap-8">
            <div>
              <h1 className="text-3xl font-bold text-gold">Training</h1>
              <p className="mt-2 text-sm text-subtle">
                Quiz yourself on the AMG lexicon. Sharpen your brand vocabulary.
              </p>
            </div>

            {/* Founder selector */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Who&apos;s training?</h2>
              <div className="flex gap-3">
                {(["Founder 55", "Founder 88"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFounder(f)}
                    className={[
                      "flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                      founder === f
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-border bg-panel text-subtle hover:border-gold/40 hover:text-fg",
                    ].join(" ")}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Category selector */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Categories</h2>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const active = selectedCategories.has(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={[
                        "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                        active
                          ? "border-gold/60 bg-gold/10 text-gold"
                          : "border-border bg-panel text-subtle hover:border-gold/30 hover:text-fg",
                      ].join(" ")}
                    >
                      {active && <CheckCircle size={12} className="text-gold" />}
                      {cat}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted">
                {LEXICON_TERMS.filter((t) => selectedCategories.has(t.category)).length} terms selected
              </p>
            </div>

            {/* Begin button */}
            <button
              onClick={beginSession}
              disabled={LEXICON_TERMS.filter((t) => selectedCategories.has(t.category)).length < 2}
              className="w-full rounded-xl border border-gold/60 bg-gold/10 py-3 text-sm font-semibold text-gold hover:bg-gold/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Begin Session
            </button>

            {/* Add a term panel */}
            <div className="rounded-2xl border border-border bg-panel p-5">
              <h2 className="text-sm font-semibold text-fg mb-1">Add a Term</h2>
              <p className="text-xs text-subtle mb-3">
                Describe a new AMG term in plain language and we&apos;ll extract and add it to the Notion lexicon.
              </p>
              <textarea
                value={addTermInput}
                onChange={(e) => setAddTermInput(e.target.value)}
                placeholder="Describe a new AMG term..."
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-fg placeholder:text-muted resize-none focus:outline-none focus:border-gold/40 transition-colors"
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={submitAddTerm}
                  disabled={addTermStatus === "loading" || !addTermInput.trim()}
                  className="rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-xs font-semibold text-gold hover:bg-gold/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {addTermStatus === "loading" ? "Submitting…" : "Submit"}
                </button>
                {addTermStatus === "success" && (
                  <p className="text-xs text-gold">{addTermMessage}</p>
                )}
                {addTermStatus === "error" && (
                  <p className="text-xs text-red-400">{addTermMessage}</p>
                )}
              </div>
            </div>
          </div>

          {/* Vale — desktop: large, right-justified */}
          <div className="hidden lg:block sticky top-6 w-[320px] xl:w-[420px] h-[75vh] shrink-0">
            <ValeHost pose="quiz-welcome" className="w-full h-full" priority />
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Results screen ───────────────────────────────────────
  if (screen === "results") {
    const pct = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    const passed = lives > 0;
    return (
      <div className="flex flex-col gap-8 pt-2 max-w-6xl">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Vale — mobile: small, above content */}
          <div className="lg:hidden self-center">
            <ValeHost pose="quiz-welcome" className="w-28 h-40" />
          </div>

          {/* Left content column */}
          <div className="flex-1 max-w-2xl flex flex-col gap-8">
            <div>
              <h1 className="text-3xl font-bold text-gold">
                {passed ? "Vale Congratulates You" : "Session Complete"}
              </h1>
              <p className="mt-2 text-sm text-subtle">
                {passed
                  ? `Well done, ${founder} — you've passed the Lexicon Training.`
                  : `Here's how you did, ${founder}.`}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-panel p-6 flex flex-col gap-4">
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold text-gold">{score}/{totalQuestions}</span>
                <span className="text-xl text-subtle">{pct}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-subtle">XP Earned:</span>
                <span className="text-sm font-semibold text-gold">+{xp} XP</span>
              </div>
              {lives === 0 && (
                <p className="text-sm text-red-400">Session ended early — all hearts lost.</p>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {passed && (
                <p className="text-xs text-subtle">
                  Next step: email your results to complete the record.
                </p>
              )}
              {/* Send score report */}
              <button
                onClick={sendReport}
                disabled={reportStatus === "loading" || reportStatus === "sent"}
                className="w-full rounded-xl border border-gold/40 bg-gold/10 py-3 text-sm font-semibold text-gold hover:bg-gold/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reportStatus === "loading"
                  ? "Sending…"
                  : reportStatus === "sent"
                  ? "Report Sent"
                  : "Send Score Report"}
              </button>
              {reportStatus === "error" && (
                <p className="text-xs text-red-400 text-center">
                  Failed to send report{reportError ? `: ${reportError}` : ""}. Try again, or check
                  Settings → Integrations for the Gmail connection.
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={beginSession}
                  className="flex-1 rounded-xl border border-border bg-panel py-3 text-sm font-medium text-fg hover:border-gold/40 hover:bg-panel-2 transition-all"
                >
                  Try Again
                </button>
                <button
                  onClick={() => setScreen("start")}
                  className="flex-1 rounded-xl border border-border bg-panel py-3 text-sm font-medium text-subtle hover:border-gold/40 hover:text-fg hover:bg-panel-2 transition-all"
                >
                  Back to Start
                </button>
              </div>
            </div>
          </div>

          {/* Vale — desktop: large, right-justified; bigger still on a pass */}
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

  // ── Render: Quiz screen ──────────────────────────────────────────
  if (!currentQuestion) return null;

  return (
    <div className="flex flex-col gap-6 pt-2 max-w-6xl">
      {/* Progress bar + lives */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-2 rounded-full bg-border">
          <div
            className="h-2 rounded-full bg-gold transition-all duration-300"
            style={{ width: `${((currentIdx) / totalQuestions) * 100}%` }}
          />
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Heart
              key={i}
              size={18}
              className={i < lives ? "text-gold fill-gold" : "text-border fill-border"}
            />
          ))}
        </div>
        <span className="text-xs text-muted whitespace-nowrap">
          {currentIdx}/{totalQuestions}
        </span>
      </div>

      {/* Quiz card + Vale, persistent for the duration of the quiz */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Vale — mobile: small, above card */}
        <div className="lg:hidden self-center">
          <ValeHost pose="stance" className="w-24 h-36" />
        </div>

        {/* Card */}
        <div className="flex-1 max-w-2xl rounded-2xl border border-border bg-panel p-6 flex flex-col gap-5">
          {/* Prompt */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
              {currentQuestion.mode === "a" ? "What does this term mean?" : "Name this term"}
            </p>
            <p
              className={[
                "text-2xl font-bold leading-snug",
                currentQuestion.mode === "a" ? "text-gold" : "text-fg",
              ].join(" ")}
            >
              {currentQuestion.mode === "a" ? currentQuestion.term.term : currentQuestion.term.plain}
            </p>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-2">
            {currentQuestion.options.map((opt) => {
              const isCorrect = opt === currentQuestion.correct;
              const isSelected = opt === selected;
              let optClass = "w-full rounded-xl border border-border bg-panel px-4 py-3 text-left text-sm text-fg hover:border-gold/40 hover:bg-panel-2 transition-all";
              if (answered) {
                if (isCorrect) {
                  optClass = "w-full rounded-xl border border-gold bg-gold/10 px-4 py-3 text-left text-sm text-gold transition-all";
                } else if (isSelected && !isCorrect) {
                  optClass = "w-full rounded-xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-left text-sm text-red-400 transition-all";
                } else {
                  optClass = "w-full rounded-xl border border-border bg-panel px-4 py-3 text-left text-sm text-muted transition-all opacity-60";
                }
              }
              return (
                <button
                  key={opt}
                  onClick={() => handleAnswer(opt)}
                  disabled={answered}
                  className={optClass}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {/* XP flash */}
          {xpFlash && (
            <div className="text-center text-gold font-bold text-lg animate-bounce">+10 XP</div>
          )}

          {/* Continue button */}
          {answered && (
            <button
              onClick={handleContinue}
              className="w-full rounded-xl border border-gold/60 bg-gold/10 py-3 text-sm font-semibold text-gold hover:bg-gold/20 transition-all"
            >
              {currentIdx + 1 >= totalQuestions ? "See Results" : "Continue"}
            </button>
          )}
        </div>

        {/* Vale — desktop: large, right-justified, persistent for the quiz */}
        <div className="hidden lg:block sticky top-6 w-[320px] xl:w-[400px] h-[70vh] shrink-0">
          <ValeHost pose="stance" className="w-full h-full" priority />
        </div>
      </div>
    </div>
  );
}

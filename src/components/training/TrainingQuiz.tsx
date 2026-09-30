"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle, Clock3, Shuffle, Sparkles } from "lucide-react";
import type { LexiconEntry } from "@/lib/lexicon-data";
import {
  buildSentenceBank,
  formatClock,
  MASTER_MATCH_BONUS_CAP,
  MASTER_MATCH_BONUS_PER_PAIR,
  MASTER_SESSION_SECONDS,
  maskSentence,
  roundAssessmentAdjustment,
  selectSentenceRounds,
  SENTENCE_ROUND_BASE_SECONDS,
  shuffle,
  type TrainingMode,
  type TrainingSentence,
} from "@/lib/training-engine";
import { ValeHost } from "./ValeHost";

type Founder = "Founder 55" | "Founder 88";
type Screen = "start" | "playing" | "results";

interface TrainingQuizProps {
  terms: LexiconEntry[];
  categories: string[];
}

interface ScoreSummary {
  score: number;
  total: number;
  xp: number;
  metrics?: Record<string, number>;
}

const MODES: Array<{ mode: TrainingMode; title: string; description: string }> = [
  { mode: "Quick Quiz", title: "Quick Quiz", description: "Definitions and usage checks without a timer." },
  { mode: "Term Match", title: "Term Match", description: "Match Lexicon terms to real-world meanings across 10 timed rounds." },
  { mode: "Sentence Completion", title: "Sentence Completion", description: "Rebuild increasingly complex Lexicon sentences using the Bonus Bank." },
  { mode: "Master Quiz", title: "Master Quiz", description: "Five mixed rounds on one five-minute clock. Matching goes first and can earn time." },
];

function useCountdown(active: boolean, initial: number, onExpire: () => void, restartKey: unknown = initial) {
  const [seconds, setSeconds] = useState(initial);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => setSeconds(initial), [initial]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          queueMicrotask(() => expireRef.current());
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [active, initial, restartKey]);
  return [seconds, setSeconds] as const;
}

async function sendScore(
  founder: Founder,
  mode: TrainingMode,
  categories: string[],
  summary: ScoreSummary,
) {
  const response = await fetch("/api/training/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ founder, mode, categories, ...summary, timestamp: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error("The score report could not be sent.");
}

function Results({ founder, mode, categories, summary, onRestart, onExit }: {
  founder: Founder; mode: TrainingMode; categories: string[]; summary: ScoreSummary;
  onRestart: () => void; onExit: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const percent = summary.total ? Math.round((summary.score / summary.total) * 100) : 0;
  return (
    <div className="max-w-2xl pt-2 flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{mode}</p>
        <h1 className="mt-2 text-3xl font-bold text-gold">Session complete</h1>
        <p className="mt-2 text-sm text-subtle">{founder}, your result is ready for review.</p>
      </div>
      <div className="rounded-2xl border border-border bg-panel p-6">
        <div className="flex items-baseline gap-3"><span className="text-5xl font-bold text-gold">{summary.score}/{summary.total}</span><span className="text-xl text-subtle">{percent}%</span></div>
        <p className="mt-3 text-sm text-subtle">XP earned: <span className="font-semibold text-gold">+{summary.xp}</span></p>
      </div>
      <button onClick={async () => { setStatus("sending"); try { await sendScore(founder, mode, categories, summary); setStatus("sent"); } catch { setStatus("error"); } }} disabled={status === "sending" || status === "sent"} className="rounded-xl border border-gold/50 bg-gold/10 py-3 text-sm font-semibold text-gold disabled:opacity-50">
        {status === "sending" ? "Sending…" : status === "sent" ? "Report sent" : "Send score report"}
      </button>
      {status === "error" && <p className="text-sm text-red-400">The report was not sent. Try again.</p>}
      <div className="flex gap-3"><button onClick={onRestart} className="flex-1 rounded-xl border border-border bg-panel py-3 text-sm text-fg">Try again</button><button onClick={onExit} className="flex-1 rounded-xl border border-border bg-panel py-3 text-sm text-subtle">Training menu</button></div>
    </div>
  );
}

function QuickQuiz({ terms, founder, categories, onExit }: { terms: LexiconEntry[]; founder: Founder; categories: string[]; onExit: () => void }) {
  const [screen, setScreen] = useState<Screen>("playing");
  const [questions, setQuestions] = useState(() => shuffle(terms).slice(0, Math.min(10, terms.length)));
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const current = questions[index];
  const options = useMemo(() => current ? shuffle([current.plain, ...shuffle(terms.filter((term) => term.term !== current.term)).slice(0, 3).map((term) => term.plain)]) : [], [current, terms]);
  if (screen === "results") return <Results founder={founder} mode="Quick Quiz" categories={categories} summary={{ score, total: questions.length, xp: score * 10 }} onRestart={() => { setQuestions(shuffle(terms).slice(0, Math.min(10, terms.length))); setIndex(0); setScore(0); setScreen("playing"); }} onExit={onExit} />;
  if (!current) return null;
  return <div className="max-w-2xl pt-2 flex flex-col gap-6"><button onClick={onExit} className="flex items-center gap-2 text-xs text-muted"><ArrowLeft size={14}/> Training menu</button><div><p className="text-xs uppercase tracking-wider text-muted">Question {index + 1}/{questions.length}</p><h1 className="mt-2 text-3xl font-bold text-gold">{current.term}</h1><p className="mt-2 text-sm text-subtle">Choose the real-world meaning.</p></div><div className="grid gap-3">{options.map((option) => <button key={option} onClick={() => { if (option === current.plain) setScore((value) => value + 1); if (index + 1 === questions.length) setScreen("results"); else setIndex((value) => value + 1); }} className="rounded-xl border border-border bg-panel p-4 text-left text-sm text-fg hover:border-gold/50">{option}</button>)}</div></div>;
}

function TermMatch({ terms, founder, categories, onExit, master = false, onMasterComplete }: { terms: LexiconEntry[]; founder: Founder; categories: string[]; onExit: () => void; master?: boolean; onMasterComplete?: (score: number, total: number, bonus: number, secondsRemaining: number) => void }) {
  const rounds = master ? 1 : 10;
  const [round, setRound] = useState(0);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<{ side: "term" | "plain"; term: string } | null>(null);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);
  const pool = useMemo(() => {
    const sorted = [...terms].sort((a, b) => (a.term.length + a.plain.length) - (b.term.length + b.plain.length));
    const half = Math.ceil(sorted.length / 2);
    return round < 5 ? sorted.slice(0, half) : sorted.slice(half);
  }, [round, terms]);
  const cards = useMemo(() => shuffle(pool).slice(0, Math.min(master ? 4 : 4 + Math.floor(round / 3), pool.length)), [master, pool, round]);
  const timeLimit = master ? MASTER_SESSION_SECONDS : 105 - round * 7;
  const [time] = useCountdown(!done, timeLimit, () => finishRound());
  const termCards = useMemo(() => shuffle(cards), [cards]);
  const plainCards = useMemo(() => shuffle(cards), [cards]);

  function finishRound() {
    const nextTotal = total + cards.length;
    setTotal(nextTotal);
    if (master) {
      const bonus = Math.min(MASTER_MATCH_BONUS_CAP, matched.size * MASTER_MATCH_BONUS_PER_PAIR);
      onMasterComplete?.(matched.size, nextTotal, bonus, time);
      setDone(true);
    } else if (round + 1 >= rounds) setDone(true);
    else { setRound((value) => value + 1); setMatched(new Set()); setSelection(null); }
  }
  useEffect(() => { if (cards.length > 0 && matched.size === cards.length && !done) queueMicrotask(finishRound); }, [matched.size, cards.length, done]);
  if (done && !master) return <Results founder={founder} mode="Term Match" categories={categories} summary={{ score, total, xp: score * 10 }} onRestart={() => window.location.reload()} onExit={onExit} />;
  const pick = (side: "term" | "plain", term: string) => {
    if (matched.has(term)) return;
    if (!selection || selection.side === side) { setSelection({ side, term }); return; }
    if (selection.term === term) { setMatched((current) => new Set(current).add(term)); setScore((value) => value + 1); }
    setSelection(null);
  };
  return <div className="max-w-5xl pt-2 flex flex-col gap-5">{!master && <button onClick={onExit} className="flex items-center gap-2 text-xs text-muted"><ArrowLeft size={14}/> Training menu</button>}<div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-muted">{master ? "Master round 1/5" : `Round ${round + 1}/${rounds}`}</p><h2 className="text-2xl font-bold text-gold">Term Match</h2></div><div className="flex items-center gap-2 text-gold"><Clock3 size={16}/><span className="font-semibold">{formatClock(time)}</span></div></div><p className="text-sm text-subtle">{master ? `Earn ${MASTER_MATCH_BONUS_PER_PAIR} seconds per pair, up to ${MASTER_MATCH_BONUS_CAP} seconds.` : "Rounds 1–5 use easier terms; rounds 6–10 use more creative language."}</p><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-2">{termCards.map((card) => <button key={card.term} disabled={matched.has(card.term)} onClick={() => pick("term", card.term)} className={`rounded-xl border p-3 text-left text-sm ${matched.has(card.term) ? "border-gold/20 text-muted opacity-40" : selection?.side === "term" && selection.term === card.term ? "border-gold bg-gold/10 text-gold" : "border-border bg-panel text-fg"}`}>{card.term}</button>)}</div><div className="grid gap-2">{plainCards.map((card) => <button key={card.term} disabled={matched.has(card.term)} onClick={() => pick("plain", card.term)} className={`rounded-xl border p-3 text-left text-sm ${matched.has(card.term) ? "border-gold/20 text-muted opacity-40" : selection?.side === "plain" && selection.term === card.term ? "border-gold bg-gold/10 text-gold" : "border-border bg-panel text-fg"}`}>{card.plain}</button>)}</div></div></div>;
}

function SentencePrompt({ sentence, terms, onSubmit }: { sentence: TrainingSentence; terms: LexiconEntry[]; onSubmit: (correct: boolean) => void }) {
  const orderedAnswers = useMemo(() => [...sentence.answers].sort((a, b) => b.length - a.length), [sentence]);
  const masked = useMemo(() => maskSentence(sentence), [sentence]);
  const [placements, setPlacements] = useState<Array<string | null>>(() => orderedAnswers.map(() => null));
  const choices = useMemo(() => shuffle([...orderedAnswers, ...shuffle(terms.filter((term) => !orderedAnswers.includes(term.term))).slice(0, Math.max(3, orderedAnswers.length)).map((term) => term.term)]), [orderedAnswers, terms, sentence.id]);
  const parts = masked.split(/(\{\{\d+\}\})/g);
  return <div className="rounded-2xl border border-border bg-panel p-6 flex flex-col gap-5"><div className="flex items-center justify-between"><span className="text-xs uppercase tracking-wider text-muted">Difficulty {sentence.difficulty}/10</span><span className="text-xs text-subtle">{sentence.kind === "direct" ? "Direct use" : "Multi-term context"}</span></div><p className="text-lg leading-9 text-fg">{parts.map((part, index) => { const match = part.match(/^\{\{(\d+)\}\}$/); if (!match) return <span key={index}>{part}</span>; const slot = Number(match[1]); return <button key={index} onClick={() => setPlacements((current) => current.map((value, i) => i === slot ? null : value))} className="mx-1 min-w-24 rounded-lg border border-dashed border-gold/50 bg-gold/5 px-2 py-1 text-sm font-semibold text-gold">{placements[slot] ?? `Blank ${slot + 1}`}</button>; })}</p><div className="flex flex-wrap gap-2">{choices.map((choice) => { const used = placements.includes(choice); return <button key={choice} disabled={used} onClick={() => setPlacements((current) => { const slot = current.findIndex((value) => value === null); return slot < 0 ? current : current.map((value, index) => index === slot ? choice : value); })} className="rounded-lg border border-border px-3 py-2 text-sm text-fg disabled:opacity-30">{choice}</button>; })}</div><button disabled={placements.some((value) => value === null)} onClick={() => onSubmit(placements.every((value, index) => value === orderedAnswers[index]))} className="rounded-xl border border-gold/50 bg-gold/10 py-3 text-sm font-semibold text-gold disabled:opacity-40">Check sentence</button></div>;
}

function SentenceCompletion({ terms, founder, categories, onExit }: { terms: LexiconEntry[]; founder: Founder; categories: string[]; onExit: () => void }) {
  const [sentences, setSentences] = useState(() => selectSentenceRounds(terms));
  const [round, setRound] = useState(0);
  const [bank, setBank] = useState(0);
  const [usingBank, setUsingBank] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [assessmentAdjustment, setAssessmentAdjustment] = useState(0);
  const base = Math.max(0, (SENTENCE_ROUND_BASE_SECONDS[round] ?? 0) + (round > 0 && round < 4 ? assessmentAdjustment : 0));
  const startSeconds = round === 4 ? bank : base;
  const [time, setTime] = useCountdown(!done, startSeconds, () => {
    if (!usingBank && bank > 0) { setUsingBank(true); setBank(0); setTime(bank); }
    else advance(false);
  }, usingBank);
  function advance(correct: boolean) {
    const earned = !usingBank && round < 4 ? time : 0;
    const nextBank = bank + earned;
    if (correct) setScore((value) => value + 1);
    const pace = base > 0 ? time / base : 0;
    setAssessmentAdjustment(roundAssessmentAdjustment(correct ? 1 : 0, pace));
    if (round + 1 >= 5) { setBank(nextBank); setDone(true); return; }
    setBank(nextBank); setUsingBank(round + 1 === 4); setRound((value) => value + 1);
  }
  if (done) return <Results founder={founder} mode="Sentence Completion" categories={categories} summary={{ score, total: 5, xp: score * 15, metrics: { bonusSecondsRemaining: bank } }} onRestart={() => { setSentences(selectSentenceRounds(terms)); setRound(0); setBank(0); setUsingBank(false); setScore(0); setDone(false); }} onExit={onExit} />;
  const sentence = sentences[round]; if (!sentence) return null;
  return <div className="max-w-3xl pt-2 flex flex-col gap-5"><button onClick={onExit} className="flex items-center gap-2 text-xs text-muted"><ArrowLeft size={14}/> Training menu</button><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-muted">Round {round + 1}/5</p><h2 className="text-2xl font-bold text-gold">Sentence Completion</h2></div><div className="text-right"><p className="font-semibold text-gold">{formatClock(time)}</p><p className="text-xs text-subtle">Bonus Bank: {formatClock(bank)}</p></div></div><div className="rounded-xl border border-border bg-panel-2 p-3 text-xs text-subtle">{round === 4 ? "Final round: Bonus Bank time only." : `Base ${formatClock(base)}${assessmentAdjustment ? ` · assessment adjustment ${assessmentAdjustment > 0 ? "+" : ""}${assessmentAdjustment}s` : ""}. Unused base time moves to the Bonus Bank.`}</div><SentencePrompt key={sentence.id} sentence={sentence} terms={terms} onSubmit={advance}/></div>;
}

function MasterQuiz({ terms, founder, categories, onExit }: { terms: LexiconEntry[]; founder: Founder; categories: string[]; onExit: () => void }) {
  const [round, setRound] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [masterStart, setMasterStart] = useState(MASTER_SESSION_SECONDS);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [sentenceRounds] = useState(() => selectSentenceRounds(terms));
  const [time] = useCountdown(!done && round > 0, masterStart, () => setDone(true));
  const question = useMemo(() => shuffle(terms)[0], [terms, round]);
  const options = useMemo(() => question ? shuffle([question.plain, ...shuffle(terms.filter((term) => term.term !== question.term)).slice(0, 3).map((term) => term.plain)]) : [], [question, terms]);
  const next = (correct: boolean) => { if (correct) setScore((value) => value + 1); if (round >= 4) setDone(true); else setRound((value) => value + 1); };
  if (done) return <Results founder={founder} mode="Master Quiz" categories={categories} summary={{ score, total: 5, xp: score * 20, metrics: { matchingBonusSeconds: bonus, secondsRemaining: time } }} onRestart={() => window.location.reload()} onExit={onExit} />;
  if (round === 0) return <TermMatch terms={terms} founder={founder} categories={categories} onExit={onExit} master onMasterComplete={(matched, total, earned, remaining) => { setScore(total > 0 && matched === total ? 1 : 0); setBonus(earned); setMasterStart(remaining + earned); setRound(1); }} />;
  return <div className="max-w-3xl pt-2 flex flex-col gap-5"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-muted">Master round {round + 1}/5</p><h2 className="text-2xl font-bold text-gold">{round < 3 ? "Recognition" : "Sentence Completion"}</h2></div><div className="text-right"><p className="font-semibold text-gold">{formatClock(time)}</p><p className="text-xs text-subtle">Includes +{bonus}s matching bonus</p></div></div>{round < 3 && question ? <div className="rounded-2xl border border-border bg-panel p-6 flex flex-col gap-4"><h3 className="text-xl font-semibold text-fg">{question.term}</h3><p className="text-sm text-subtle">Choose its real-world meaning.</p>{options.map((option) => <button key={option} onClick={() => next(option === question.plain)} className="rounded-xl border border-border p-3 text-left text-sm text-fg">{option}</button>)}</div> : <SentencePrompt key={sentenceRounds[Math.min(sentenceRounds.length - 1, round)].id} sentence={sentenceRounds[Math.min(sentenceRounds.length - 1, round)]} terms={terms} onSubmit={next}/>}</div>;
}

export function TrainingQuiz({ terms, categories }: TrainingQuizProps) {
  const [founder, setFounder] = useState<Founder>("Founder 55");
  const [selectedCategories, setSelectedCategories] = useState(new Set(categories));
  const [mode, setMode] = useState<TrainingMode | null>(null);
  const selectedTerms = terms.filter((term) => selectedCategories.has(term.category));
  const selected = Array.from(selectedCategories);
  const toggle = (category: string) => setSelectedCategories((current) => { const next = new Set(current); if (next.has(category) && next.size > 1) next.delete(category); else next.add(category); return next; });
  if (mode === "Quick Quiz") return <QuickQuiz terms={selectedTerms} founder={founder} categories={selected} onExit={() => setMode(null)}/>;
  if (mode === "Term Match") return <TermMatch terms={selectedTerms} founder={founder} categories={selected} onExit={() => setMode(null)}/>;
  if (mode === "Sentence Completion") return <SentenceCompletion terms={selectedTerms} founder={founder} categories={selected} onExit={() => setMode(null)}/>;
  if (mode === "Master Quiz") return <MasterQuiz terms={selectedTerms} founder={founder} categories={selected} onExit={() => setMode(null)}/>;
  return <div className="max-w-6xl pt-2 flex flex-col gap-8"><div className="flex flex-col lg:flex-row gap-8 items-start"><div className="flex-1 max-w-3xl flex flex-col gap-8"><div><h1 className="text-3xl font-bold text-gold">Training</h1><p className="mt-2 text-sm text-subtle">Choose a founder, a training format, and the Lexicon categories to practice.</p></div><section><h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Who&apos;s training?</h2><div className="flex gap-3">{(["Founder 55", "Founder 88"] as Founder[]).map((value) => <button key={value} onClick={() => setFounder(value)} className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium ${founder === value ? "border-gold bg-gold/10 text-gold" : "border-border bg-panel text-subtle"}`}>{value}</button>)}</div></section><section><h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Training type</h2><div className="grid gap-3 sm:grid-cols-2">{MODES.map((item) => <button key={item.mode} onClick={() => setMode(item.mode)} disabled={selectedTerms.length < 6} className="rounded-2xl border border-border bg-panel p-5 text-left hover:border-gold/50 disabled:opacity-40"><div className="flex items-center gap-2 text-gold">{item.mode === "Master Quiz" ? <Sparkles size={16}/> : item.mode === "Term Match" ? <Shuffle size={16}/> : <CheckCircle size={16}/>}<span className="font-semibold">{item.title}</span></div><p className="mt-2 text-xs leading-relaxed text-subtle">{item.description}</p></button>)}</div></section><section><h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Categories</h2><div className="flex flex-wrap gap-2">{categories.map((category) => <button key={category} onClick={() => toggle(category)} className={`rounded-lg border px-3 py-2 text-xs ${selectedCategories.has(category) ? "border-gold/60 bg-gold/10 text-gold" : "border-border bg-panel text-subtle"}`}>{category}</button>)}</div><p className="mt-2 text-xs text-muted">{selectedTerms.length} controlled terms · {buildSentenceBank(selectedTerms).length} sentence prompts</p></section></div><div className="hidden lg:block sticky top-6 w-[360px] h-[75vh] shrink-0"><ValeHost pose="quiz-welcome" className="w-full h-full" priority/></div></div></div>;
}

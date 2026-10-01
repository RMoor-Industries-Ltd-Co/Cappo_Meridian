"use client";

import { useState } from "react";
import type { TrainingMode } from "@/lib/training/registry";

interface ScoreSummary {
  score: number;
  total: number;
  xp: number;
  metrics?: Record<string, number>;
}

async function sendScore(
  founder: "Founder 55" | "Founder 88",
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

/** Shared results screen for games that reduce to a simple score/total/XP summary. */
export function Results({
  founder,
  mode,
  categories,
  summary,
  onRestart,
  onExit,
}: {
  founder: "Founder 55" | "Founder 88";
  mode: TrainingMode;
  categories: string[];
  summary: ScoreSummary;
  onRestart: () => void;
  onExit: () => void;
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
        <div className="flex items-baseline gap-3">
          <span className="text-5xl font-bold text-gold">{summary.score}/{summary.total}</span>
          <span className="text-xl text-subtle">{percent}%</span>
        </div>
        <p className="mt-3 text-sm text-subtle">XP earned: <span className="font-semibold text-gold">+{summary.xp}</span></p>
      </div>
      <button
        onClick={async () => {
          setStatus("sending");
          try {
            await sendScore(founder, mode, categories, summary);
            setStatus("sent");
          } catch {
            setStatus("error");
          }
        }}
        disabled={status === "sending" || status === "sent"}
        className="rounded-xl border border-gold/50 bg-gold/10 py-3 text-sm font-semibold text-gold disabled:opacity-50"
      >
        {status === "sending" ? "Sending…" : status === "sent" ? "Report sent" : "Send score report"}
      </button>
      {status === "error" && <p className="text-sm text-red-400">The report was not sent. Try again.</p>}
      <div className="flex gap-3">
        <button onClick={onRestart} className="flex-1 rounded-xl border border-border bg-panel py-3 text-sm text-fg">Try again</button>
        <button onClick={onExit} className="flex-1 rounded-xl border border-border bg-panel py-3 text-sm text-subtle">Training menu</button>
      </div>
    </div>
  );
}

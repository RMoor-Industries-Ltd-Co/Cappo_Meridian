import { isDbConfigured } from "@/lib/env";
import { getLastLexiconSync } from "@/lib/db";
import { syncLexiconFromNotion } from "@/lib/lexiconSync";

// This is a single-container deploy (see docker-compose.yml) with no separate
// worker/cron service, so a daily sync runs in-process instead: check hourly,
// but only actually sync once at least a day has passed since the last run
// (tracked in Postgres, so it survives restarts/redeploys).
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const MIN_GAP_MS = 24 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 30 * 1000;

let started = false;

async function maybeSync(): Promise<void> {
  try {
    const last = await getLastLexiconSync();
    const sinceLast = last ? Date.now() - new Date(last.ran_at).getTime() : Infinity;
    if (sinceLast < MIN_GAP_MS) return;

    const result = await syncLexiconFromNotion();
    console.log(
      `[lexicon-sync] ${result.total} term(s) — ${result.added} new, ${result.updated} updated`,
    );
  } catch (err) {
    console.error("[lexicon-sync] failed:", err instanceof Error ? err.message : err);
  }
}

/** Starts the daily Notion → Lexicon sync. Safe to call once per server instance. */
export function startLexiconDailySync(): void {
  if (started || !isDbConfigured()) return;
  started = true;
  setTimeout(() => void maybeSync(), INITIAL_DELAY_MS);
  setInterval(() => void maybeSync(), CHECK_INTERVAL_MS);
}

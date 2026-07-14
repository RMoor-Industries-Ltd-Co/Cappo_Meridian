import { isDbConfigured } from "@/lib/env";
import { getLastCappoReport, saveCappoReport } from "@/lib/db";
import { runCappoAgent } from "@/lib/agent";

// Same single-container-deploy pattern as lexiconScheduler.ts: check hourly, but only
// actually regenerate once at least CHECK_GAP_MS has passed since the last report
// (tracked in Postgres, so it survives restarts/redeploys without duplicating work).
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const MIN_GAP_MS = 6 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 45 * 1000;

// Matches reporting-rules.md's required content ("domain status, key signals, risks,
// blockers") from rmg-piaar-system's governance law — this is the cached report ALLIE
// pulls via GET /api/agent/report instead of triggering live work every time.
const REPORT_PROMPT =
  "Give a concise AMG executive status report — current priorities, key signals, risks, and " +
  "blockers across ClickUp/Notion/Drive/Gmail. Plain language, 5-8 sentences max. Only report " +
  "what you can verify by checking the actual systems; if something is unclear or unreachable, " +
  "say so rather than guessing.";

let started = false;

async function maybeGenerate(): Promise<void> {
  try {
    const last = await getLastCappoReport();
    const sinceLast = last ? Date.now() - new Date(last.generated_at).getTime() : Infinity;
    if (sinceLast < MIN_GAP_MS) return;

    const report = await runCappoAgent(REPORT_PROMPT);
    await saveCappoReport(report);
    console.log("[cappo-report] generated and cached");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cappo-report] failed:", message);
    await saveCappoReport(null, message).catch(() => {});
  }
}

/** Starts the periodic AMG executive report generation. Safe to call once per server instance. */
export function startCappoReportScheduler(): void {
  if (started || !isDbConfigured()) return;
  started = true;
  setTimeout(() => void maybeGenerate(), INITIAL_DELAY_MS);
  setInterval(() => void maybeGenerate(), CHECK_INTERVAL_MS);
}

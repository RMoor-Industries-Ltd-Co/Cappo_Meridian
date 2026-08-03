/**
 * Historical meeting backfill.
 *
 * Run from a workstation, NOT from the web server:
 *
 *     pnpm backfill:meetings -- --from=2024-01-01 --dry-run
 *     pnpm backfill:meetings -- --from=2024-01-01 --to=2026-08-01
 *
 * Backfilling years of transcripts is long, bursty, rate-limited work. Putting
 * it behind an HTTP route would tie it to a request timeout and load the server
 * that partners are using; a CLI keeps historical processing entirely off that
 * path, which was the point of moving the archive to Drive in the first place.
 *
 * Three properties make it safe to run against a real mailbox:
 *
 *   RESUMABLE — progress is checkpointed into the archive spreadsheet's
 *   `_state` tab after every window, so an interrupted run continues where it
 *   stopped rather than starting over. The checkpoint lives in Drive, not
 *   Postgres, so a rebuilt database never loses the position.
 *
 *   IDEMPOTENT — transcripts already in Drive are not rewritten and meetings
 *   already in the Database tab keep their existing key. Re-running an
 *   overlapping window is a no-op, not a duplicate.
 *
 *   POLITE — windows are processed one at a time with a pause between them, and
 *   rate-limit responses are retried with exponential backoff instead of being
 *   hammered or dropped.
 *
 * Start with --dry-run. It reads without writing and reports the per-source
 * yield, which is the honest way to find out how much Notion and ClickUp
 * actually contribute before committing to a full run.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

// ── Environment ─────────────────────────────────────────────────────
// A standalone script gets none of Next's env loading, and `@/lib/env`
// validates at import time — so .env must be in place BEFORE any app module is
// imported. Hence the dynamic imports further down.

async function loadEnvFile(file: string): Promise<void> {
  let text: string;
  try {
    text = await fs.readFile(path.join(process.cwd(), file), "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/i.exec(line);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (process.env[key] !== undefined) continue; // real env wins
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

// ── Arguments ───────────────────────────────────────────────────────

interface Args {
  from: string;
  to: string;
  dryRun: boolean;
  stepDays: number;
  maxPerSource: number;
  reset: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined =>
    argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
  const has = (name: string) => argv.includes(`--${name}`);

  const from = get("from");
  if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    throw new Error("--from=YYYY-MM-DD is required (the oldest date to scan).");
  }
  const to = get("to") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new Error("--to must be YYYY-MM-DD.");
  if (to <= from) throw new Error("--to must be after --from.");

  return {
    from,
    to,
    dryRun: has("dry-run"),
    stepDays: Number(get("step-days") ?? 30),
    maxPerSource: Number(get("max-per-source") ?? 100),
    reset: has("reset"),
  };
}

// ── Windows ─────────────────────────────────────────────────────────

/** Gmail's date operators take YYYY/MM/DD and are half-open: [after, before). */
function gmailDate(d: Date): string {
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
}

interface Window {
  startISO: string;
  endISO: string;
  query: string;
}

function buildWindows(from: string, to: string, stepDays: number): Window[] {
  const windows: Window[] = [];
  let cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor < end) {
    const next = new Date(cursor);
    next.setUTCDate(next.getUTCDate() + stepDays);
    const stop = next > end ? end : next;
    windows.push({
      startISO: cursor.toISOString().slice(0, 10),
      endISO: stop.toISOString().slice(0, 10),
      query: `after:${gmailDate(cursor)} before:${gmailDate(stop)}`,
    });
    cursor = stop;
  }
  return windows;
}

// ── Rate limiting ───────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Pause between windows so a long run doesn't look like an attack. */
const WINDOW_PAUSE_MS = 1_500;

function isRateLimit(err: unknown): boolean {
  const e = err as { code?: number; status?: number; message?: string } | null;
  if (!e) return false;
  const status = e.code ?? e.status;
  if (status === 429) return true;
  const msg = e.message ?? "";
  return (
    (status === 403 && /rateLimitExceeded|userRateLimitExceeded|quota/i.test(msg)) ||
    /rateLimitExceeded|userRateLimitExceeded/i.test(msg)
  );
}

/**
 * Retry on rate limiting with exponential backoff. Anything else is rethrown
 * immediately — retrying a genuine error just delays the report.
 */
async function withBackoff<T>(label: string, fn: () => Promise<T>, attempts = 5): Promise<T> {
  let delay = 2_000;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts || !isRateLimit(err)) throw err;
      console.warn(`  ⏳ rate limited on ${label}; retrying in ${delay / 1000}s (${i}/${attempts - 1})`);
      await sleep(delay);
      delay *= 2;
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────

const CURSOR_KEY = "backfill.cursor";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  await loadEnvFile(".env.local");
  await loadEnvFile(".env");

  const { ingestMeetings } = await import("../src/lib/meetings/ingest");
  const { openArchive, readState, writeState, seedCategories, ARCHIVE_FOLDER_ID } = await import(
    "../src/lib/meetings/archive"
  );

  console.log(`\n📁 Archive folder: ${ARCHIVE_FOLDER_ID}`);
  console.log(`📅 Range: ${args.from} → ${args.to}  (${args.stepDays}-day windows)`);
  console.log(args.dryRun ? "🔍 DRY RUN — nothing will be written\n" : "✍️  Writing to the archive\n");

  if (!args.dryRun) {
    await withBackoff("open archive", () => openArchive());
    await withBackoff("seed categories", () => seedCategories());
  }

  let windows = buildWindows(args.from, args.to, args.stepDays);

  // Resume from the checkpoint unless explicitly told to start over. Dry runs
  // never resume — the point of a dry run is to see the whole range.
  if (!args.dryRun && !args.reset) {
    const cursor = await readState(CURSOR_KEY).catch(() => null);
    if (cursor) {
      const remaining = windows.filter((w) => w.startISO >= cursor);
      const done = windows.length - remaining.length;
      if (done > 0) {
        console.log(`↩️  Resuming at ${cursor} — ${done} window(s) already complete.\n`);
        windows = remaining;
      }
    }
  }

  const totals = {
    scanned: 0,
    archived: 0,
    meetings: 0,
    skipped: 0,
    inferredTimes: 0,
    bySource: {} as Record<string, number>,
    errors: [] as string[],
  };

  for (const [i, w] of windows.entries()) {
    const label = `${w.startISO}→${w.endISO}`;
    process.stdout.write(`[${i + 1}/${windows.length}] ${label} … `);

    try {
      const r = await withBackoff(label, () =>
        ingestMeetings({
          window: w.query,
          maxPerSource: args.maxPerSource,
          dryRun: args.dryRun,
        }),
      );

      totals.scanned += r.scanned;
      totals.archived += r.archived;
      totals.meetings += r.meetings;
      totals.skipped += r.skipped;
      totals.inferredTimes += r.inferredTimes;
      for (const [k, v] of Object.entries(r.bySource)) {
        totals.bySource[k] = (totals.bySource[k] ?? 0) + v;
      }
      totals.errors.push(...r.errors.map((e) => `${label}: ${e}`));

      console.log(
        `${r.meetings} meeting(s), ${r.archived} file(s), ${r.skipped} skipped` +
          (r.errors.length ? `, ${r.errors.length} error(s)` : ""),
      );

      // Checkpoint AFTER the window completes, so an interruption re-runs the
      // window it died in rather than skipping it. Re-running is free.
      if (!args.dryRun) await writeState(CURSOR_KEY, w.endISO).catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAILED — ${msg}`);
      totals.errors.push(`${label}: ${msg}`);
      // Keep going: one bad window shouldn't end a multi-year run. The
      // checkpoint is not advanced, so a later re-run retries this window.
    }

    if (i < windows.length - 1) await sleep(WINDOW_PAUSE_MS);
  }

  // ── Report ────────────────────────────────────────────────────────
  console.log("\n─────────── summary ───────────");
  console.log(`notifications scanned : ${totals.scanned}`);
  console.log(`meetings              : ${totals.meetings}`);
  if (!args.dryRun) console.log(`transcript files      : ${totals.archived}`);
  console.log(`skipped (no content)  : ${totals.skipped}`);
  console.log(`unknown meeting time  : ${totals.inferredTimes}`);

  console.log("\nper-source yield:");
  const sources = ["gemini", "fathom", "notion", "clickup"];
  for (const s of sources) {
    const n = totals.bySource[s] ?? 0;
    console.log(`  ${s.padEnd(8)} ${String(n).padStart(5)}${n === 0 ? "   ← contributed nothing" : ""}`);
  }

  if (totals.errors.length) {
    console.log(`\n⚠️  ${totals.errors.length} error(s):`);
    for (const e of totals.errors.slice(0, 25)) console.log(`  - ${e}`);
    if (totals.errors.length > 25) console.log(`  … and ${totals.errors.length - 25} more`);
  }

  if (totals.inferredTimes > 0) {
    console.log(
      `\nNote: ${totals.inferredTimes} meeting(s) had no stated time, so the notification\n` +
        `timestamp was used and the row is marked duration_known = FALSE. Those keys\n` +
        `are approximate by construction — they are not silently precise.`,
    );
  }
  console.log("");
}

main().catch((err) => {
  console.error("\n❌ Backfill failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

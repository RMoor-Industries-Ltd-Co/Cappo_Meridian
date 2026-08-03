import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { gmailSend } from "@/lib/connectors/gmail";
import {
  claimDigest,
  getDigest,
  getRollup,
  listInitiatives,
  markDigestSent,
  recentBriefs,
  type Initiative,
} from "@/lib/db";
import { currentQuarter, quarterDateRange } from "@/lib/quarters";

/**
 * The daily board digest.
 *
 * Context is assembled hierarchically rather than by re-reading history: open
 * initiatives + the last week of meeting briefs + the current quarter's rollup.
 * That keeps a year of accumulated meaning available at a bounded, predictable
 * cost — re-summarizing every transcript daily would not survive the first
 * quarter.
 */

const DIGEST_MODEL = "claude-opus-4-8";

function getAnthropic(): Anthropic | null {
  const key = env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY;
  return key ? new Anthropic({ apiKey: key }) : null;
}

const SYSTEM = `You are Cappo, the AI operations engine for Apex Meridian Group, writing the daily initiative digest for the AMG board.

Your reader is a partner who was not in most of these meetings and has three minutes. Write for them.

Structure the digest in exactly these sections, using "## " headings, and omit any section that would be empty:

## Since yesterday
What actually moved — new initiatives raised, initiatives that advanced, anything closed. If nothing moved, say so in one line rather than padding.

## Current initiatives
The active work, each as a short paragraph: what it is, where it stands, who owns it if known. Lead with whatever moved most recently.

## On the horizon
Initiatives still in the future horizon — decided or intended, not yet underway.

## This quarter in context
Two or three sentences placing the above against the quarter's arc so far.

Rules:
- Ground every claim in the material you are given. Never invent progress, dates, names, or numbers.
- Where the material is thin, say less. A short honest digest beats a padded one.
- No preamble, no sign-off, no "here is your digest" — start at the first heading.
- Plain declarative prose. No hype, no emoji, no exclamation marks.`;

function initiativeLines(items: Initiative[]): string {
  if (!items.length) return "(none)";
  return items
    .map(
      (i) =>
        `- ${i.title}${i.owner ? ` [owner: ${i.owner}]` : ""} — ${i.summary} (last discussed ${i.last_seen_at.slice(0, 10)})`,
    )
    .join("\n");
}

/**
 * Local YYYY-MM-DD. Deliberately not toISOString(), which converts to UTC and
 * would file an early-morning digest under the previous day.
 */
function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Today in the board's local terms — the digest is a calendar-day artifact. */
export function todayKey(d = new Date()): string {
  return ymd(d);
}

export function digestRecipients(): string {
  return env.DIGEST_RECIPIENTS || "board@apex-meridian-group.com";
}

/** Assemble the bounded context and write the digest body (markdown-ish). */
export async function composeDigest(): Promise<{ subject: string; body: string } | null> {
  const ai = getAnthropic();
  if (!ai) throw new Error("Anthropic key not configured");

  const all = await listInitiatives();
  const current = all.filter((i) => i.horizon === "current");
  const future = all.filter((i) => i.horizon === "future");
  const briefs = await recentBriefs(7);

  const q = currentQuarter();
  const { start } = quarterDateRange(q);
  const rollup = await getRollup("quarter", ymd(start));

  const yesterday = await getDigest(todayKey(new Date(Date.now() - 86_400_000)));

  // Nothing to say and nothing to say it about — don't mail the board noise.
  if (!all.length && !briefs.length) return null;

  const context = [
    `CURRENT INITIATIVES:\n${initiativeLines(current)}`,
    `FUTURE INITIATIVES:\n${initiativeLines(future)}`,
    `MEETING BRIEFS, LAST 7 DAYS:\n${
      briefs.length
        ? briefs.map((b) => `- ${b.occurred_at.slice(0, 10)} · ${b.title}\n  ${b.brief}`).join("\n")
        : "(no meetings recorded)"
    }`,
    `QUARTER (${q}) NARRATIVE SO FAR:\n${rollup ?? "(not yet established)"}`,
    yesterday
      ? `YESTERDAY'S DIGEST (for continuity — do not repeat items as "new"):\n${yesterday.body_text}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const res = await ai.messages.create({
    model: DIGEST_MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: "user", content: context }],
  });
  const body = res.content
    .filter((c) => c.type === "text")
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("")
    .trim();

  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return { subject: `AMG Initiative Digest — ${date}`, body };
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Minimal, email-client-safe HTML. Inline styles only — no <style>, no classes. */
export function renderHtml(subject: string, body: string): string {
  const blocks = body.split(/\n{2,}/).map((raw) => {
    const b = raw.trim();
    if (!b) return "";
    if (b.startsWith("## ")) {
      return `<h2 style="margin:28px 0 10px;font:600 15px/1.3 Helvetica,Arial,sans-serif;color:#111;letter-spacing:.02em;text-transform:uppercase">${esc(b.slice(3))}</h2>`;
    }
    if (/^[-*] /m.test(b)) {
      const items = b
        .split("\n")
        .filter((l) => /^[-*] /.test(l.trim()))
        .map((l) => `<li style="margin:0 0 6px">${esc(l.trim().slice(2))}</li>`)
        .join("");
      return `<ul style="margin:0 0 14px;padding-left:20px;font:400 14px/1.6 Helvetica,Arial,sans-serif;color:#333">${items}</ul>`;
    }
    return `<p style="margin:0 0 14px;font:400 14px/1.6 Helvetica,Arial,sans-serif;color:#333">${esc(b)}</p>`;
  });

  return `<div style="background:#f6f6f4;padding:24px 12px">
  <div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e4e4e0;border-radius:8px;padding:28px 32px">
    <p style="margin:0 0 4px;font:600 11px/1 Helvetica,Arial,sans-serif;color:#9a8f6f;letter-spacing:.12em;text-transform:uppercase">Apex Meridian Group</p>
    <h1 style="margin:0 0 20px;font:600 20px/1.3 Helvetica,Arial,sans-serif;color:#111">${esc(subject)}</h1>
    ${blocks.join("\n    ")}
    <p style="margin:28px 0 0;padding-top:14px;border-top:1px solid #eee;font:400 12px/1.5 Helvetica,Arial,sans-serif;color:#999">
      Compiled by Cappo from meeting transcripts across Gemini, Fathom, Notion, and ClickUp.
    </p>
  </div>
</div>`;
}

export interface DigestRunResult {
  status: "sent" | "already-sent" | "nothing-to-report";
  sentFor: string;
  subject?: string;
  recipients?: string;
  gmailMsgId?: string;
}

/**
 * Compose and mail the digest for today. Idempotent: the unique constraint on
 * digests.sent_for means a second run on the same day reports already-sent
 * instead of mailing the board twice.
 */
export async function runDigest(opts: { dryRun?: boolean } = {}): Promise<DigestRunResult> {
  const sentFor = todayKey();
  const existing = await getDigest(sentFor);
  if (existing?.sent_at) {
    return { status: "already-sent", sentFor, subject: existing.subject, recipients: existing.recipients };
  }

  const composed = await composeDigest();
  if (!composed) return { status: "nothing-to-report", sentFor };

  const html = renderHtml(composed.subject, composed.body);
  const recipients = digestRecipients();

  if (opts.dryRun) {
    return { status: "nothing-to-report", sentFor, subject: composed.subject, recipients };
  }

  // Claim the slot BEFORE sending, so a crash mid-send can't produce a
  // second email on retry.
  const id =
    existing?.id ??
    (await claimDigest({
      sentFor,
      subject: composed.subject,
      html,
      text: composed.body,
      recipients,
    }));
  if (!id) return { status: "already-sent", sentFor, subject: composed.subject, recipients };

  const msgId = await gmailSend(recipients, composed.subject, composed.body, html);
  await markDigestSent(id, msgId);
  return { status: "sent", sentFor, subject: composed.subject, recipients, gmailMsgId: msgId };
}

/** Compose without persisting or sending — powers the UI preview. */
export async function previewDigest(): Promise<{ subject: string; body: string; html: string } | null> {
  const composed = await composeDigest();
  if (!composed) return null;
  return { ...composed, html: renderHtml(composed.subject, composed.body) };
}

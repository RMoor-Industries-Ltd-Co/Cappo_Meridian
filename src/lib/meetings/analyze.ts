import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import {
  addMention,
  createInitiative,
  listInitiatives,
  markTranscriptAnalyzed,
  pendingTranscripts,
  updateInitiative,
  type Horizon,
  type Initiative,
  type InitiativeStatus,
} from "@/lib/db";

/**
 * Transcript → initiative registry.
 *
 * The registry has to EVOLVE, not accumulate: the same programme discussed in
 * six meetings must end up as one initiative with six mentions, not six
 * near-duplicate rows. That is achieved by handing the model the current
 * registry (compacted to slug + title + one-line summary) alongside each new
 * transcript, and making it emit reconciliation *operations* rather than a
 * fresh list of what it saw.
 *
 * Every operation carries a verbatim excerpt, which is stored as a mention — so
 * any claim the daily digest makes can be traced back to the meeting and the
 * words that produced it.
 */

const ANALYSIS_MODEL = "claude-opus-4-8";
/** Transcripts are long; cap what we send so one marathon meeting can't blow the budget. */
const MAX_TRANSCRIPT_CHARS = 60_000;

function getAnthropic(): Anthropic | null {
  const key = env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY;
  return key ? new Anthropic({ apiKey: key }) : null;
}

const SYSTEM = `You are the analyst behind Apex Meridian Group's meeting intelligence system.

You read one meeting transcript at a time and maintain a living registry of AMG's initiatives — the things the business is actually working on (CURRENT) and the things it has decided or intends to work on later (FUTURE).

THE CARDINAL RULE — RECONCILE, DON'T DUPLICATE.
You are given the existing registry. Before creating anything, check whether the topic is already there under a different wording. "The supplier consolidation push", "consolidating vendors", and "the vendor RFP" are almost certainly ONE initiative. If it exists, emit an "update" — never a second "create". Only create when the transcript introduces something genuinely absent from the registry.

HORIZON. An initiative is "future" while it is intent, aspiration, or a decision not yet started; it becomes "current" once work is actually underway. When a transcript shows that shift, emit an update moving it from future to current, and say so in changeNote.

CLOSING. When a transcript shows an initiative finished, shipped, or explicitly abandoned, emit a "close" with status "completed" or "dropped". Don't close on ambiguity — silence about an initiative is not evidence it ended.

EXCERPTS must be verbatim from the transcript, and long enough to stand on their own (roughly one to three sentences). They are the audit trail; a paraphrase makes the record useless.

WHAT NOT TO EXTRACT. Scheduling chatter, pleasantries, one-off questions, and status updates that don't move anything are not initiatives. A meeting can legitimately produce zero operations. Prefer a short, honest set over an inflated one.

Also write a 3-5 sentence brief of the meeting: what it was about, what was decided, what changed. Neutral and factual — no hype.`;

const TOOL = {
  name: "record_analysis",
  description: "Record the meeting brief and the operations that reconcile this meeting against the initiative registry.",
  input_schema: {
    type: "object" as const,
    properties: {
      brief: {
        type: "string",
        description: "3-5 sentence factual brief of the meeting.",
      },
      operations: {
        type: "array",
        description: "Reconciliation operations. May be empty when the meeting moved nothing.",
        items: {
          type: "object",
          properties: {
            op: { type: "string", enum: ["create", "update", "close"] },
            slug: {
              type: "string",
              description: "REQUIRED for update/close — the existing initiative's slug, copied exactly from the registry.",
            },
            title: { type: "string", description: "REQUIRED for create — short name for the initiative." },
            summary: { type: "string", description: "One or two sentences on what the initiative is and where it stands." },
            horizon: { type: "string", enum: ["current", "future"] },
            status: { type: "string", enum: ["completed", "dropped"], description: "close only." },
            owner: { type: "string", description: "Person accountable, if the transcript names one." },
            excerpt: { type: "string", description: "Verbatim quote from the transcript supporting this operation." },
            changeNote: { type: "string", description: "update/close only — how this meeting moved the initiative." },
          },
          required: ["op", "excerpt"],
        },
      },
    },
    required: ["brief", "operations"],
  },
};

interface Operation {
  op: "create" | "update" | "close";
  slug?: string;
  title?: string;
  summary?: string;
  horizon?: Horizon;
  status?: "completed" | "dropped";
  owner?: string;
  excerpt: string;
  changeNote?: string;
}

/** The registry as the model sees it — compact enough to send with every transcript. */
function compactRegistry(items: Initiative[]): string {
  if (!items.length) return "(empty — this is the first meeting analyzed)";
  return items
    .map((i) => `- [${i.slug}] (${i.horizon}) ${i.title} — ${i.summary}`)
    .join("\n");
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

export interface AnalyzeResult {
  analyzed: number;
  created: number;
  updated: number;
  closed: number;
  errors: string[];
}

/** Analyze up to `limit` unprocessed transcripts, oldest meeting first. */
export async function analyzePending(limit = 10): Promise<AnalyzeResult> {
  const out: AnalyzeResult = { analyzed: 0, created: 0, updated: 0, closed: 0, errors: [] };
  const ai = getAnthropic();
  if (!ai) {
    out.errors.push("Anthropic key not configured");
    return out;
  }

  const batch = await pendingTranscripts(limit);
  for (const t of batch) {
    try {
      // Re-read the registry each iteration: an initiative created by the
      // previous transcript must be visible to this one, or the second meeting
      // discussing it would create a duplicate.
      const registry = await listInitiatives();
      const transcript = t.body.slice(0, MAX_TRANSCRIPT_CHARS);
      const truncated = t.body.length > MAX_TRANSCRIPT_CHARS;

      const res = await ai.messages.create({
        model: ANALYSIS_MODEL,
        max_tokens: 4000,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: "tool", name: "record_analysis" },
        messages: [
          {
            role: "user",
            content: `EXISTING INITIATIVE REGISTRY:\n${compactRegistry(registry)}\n\n---\n\nMEETING: ${t.title}\nDATE: ${t.occurred_at}\nSOURCE: ${t.source}\n\nTRANSCRIPT:\n${transcript}${truncated ? "\n\n[transcript truncated]" : ""}`,
          },
        ],
      });

      const block = res.content.find((c) => c.type === "tool_use");
      if (!block || block.type !== "tool_use") {
        out.errors.push(`${t.id}: model returned no analysis`);
        continue;
      }
      const parsed = block.input as { brief: string; operations: Operation[] };
      const seenAt = t.occurred_at;

      for (const op of parsed.operations ?? []) {
        if (!op.excerpt?.trim()) continue;

        if (op.op === "create") {
          if (!op.title?.trim()) continue;
          // Guard the cardinal rule in code too: if the slug already exists,
          // treat it as an update so a mislabeled op can't duplicate a row.
          const slug = slugify(op.title);
          const existing = registry.find((r) => r.slug === slug);
          const row = existing
            ? await updateInitiative(slug, { summary: op.summary, horizon: op.horizon, owner: op.owner, seenAt })
            : await createInitiative({
                title: op.title.trim(),
                slug,
                summary: op.summary?.trim() || op.title.trim(),
                horizon: op.horizon ?? "current",
                owner: op.owner ?? null,
                seenAt,
              });
          if (row) {
            await addMention({
              initiativeId: row.id,
              meetingId: t.meeting_id,
              excerpt: op.excerpt,
              changeNote: op.changeNote ?? (existing ? null : "First raised in this meeting."),
            });
            if (existing) out.updated++;
            else out.created++;
          }
          continue;
        }

        if (!op.slug) {
          out.errors.push(`${t.id}: ${op.op} without slug`);
          continue;
        }
        const status: InitiativeStatus | undefined = op.op === "close" ? op.status ?? "completed" : undefined;
        const row = await updateInitiative(op.slug, {
          summary: op.summary,
          horizon: op.horizon,
          owner: op.owner,
          status,
          seenAt,
        });
        if (!row) {
          out.errors.push(`${t.id}: unknown slug "${op.slug}"`);
          continue;
        }
        await addMention({
          initiativeId: row.id,
          meetingId: t.meeting_id,
          excerpt: op.excerpt,
          changeNote: op.changeNote ?? null,
        });
        if (op.op === "close") out.closed++;
        else out.updated++;
      }

      await markTranscriptAnalyzed(t.id, parsed.brief ?? "");
      out.analyzed++;
    } catch (e) {
      out.errors.push(`${t.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return out;
}

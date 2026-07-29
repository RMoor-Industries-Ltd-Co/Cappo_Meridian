/**
 * GrantOps application assistant — the AI behind the guided, page-by-page flow.
 *
 * Two entry points, both grounded in the SAME context (the current grant's metadata,
 * the applicant entity's profile + Drive knowledge, and previously-written grant copy):
 *   1. analyzeScreenshotToQA — reads a screenshot of a real application page (vision),
 *      extracts every question/field, and drafts an answer to each.
 *   2. draftAnswersForKnownQuestions — same, for questions already known ahead of time
 *      (the opportunity's applicationQuestions), with no image.
 *
 * The recommended vision-capable model is used for both. Output is always DRAFT copy
 * for founder review — nothing here is ever submitted anywhere. Best-effort: any
 * failure returns an empty list so the caller degrades gracefully.
 */

import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { daysUntil, type EntityProfile, type FundingOpportunity } from "./types";
import { DOCUMENT_LABELS } from "./store";

// Recommended, most-capable model — it supports vision, which the screenshot path needs.
const ASSISTANT_MODEL = "claude-opus-4-8";

export interface DraftedQA {
  question: string;
  answer: string;
}

/** Anthropic client from the same key ALLEN/Cappo already use (or null if unset). */
function anthropic(): Anthropic | null {
  const key = env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY;
  return key ? new Anthropic({ apiKey: key }) : null;
}

export function isAssistantConfigured(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY);
}

/** Base64-encoded image media types the vision model accepts. */
export type ImageMediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

export function normalizeImageMediaType(mime: string | undefined): ImageMediaType | null {
  switch ((mime || "").toLowerCase()) {
    case "image/png":
      return "image/png";
    case "image/jpg":
    case "image/jpeg":
      return "image/jpeg";
    case "image/webp":
      return "image/webp";
    case "image/gif":
      return "image/gif";
    default:
      return null;
  }
}

function entityBlock(entity: EntityProfile | undefined, code: string): string {
  if (!entity) return `Applicant entity: ${code} (no detailed profile on file — keep claims generic and verifiable).`;
  return [
    `Applicant entity: ${entity.entityName} (${entity.entityCode}), a ${entity.entityType.replace(/_/g, " ")}.`,
    entity.legalName && `Legal name: ${entity.legalName}.`,
    entity.description && `Description: ${entity.description}`,
    entity.summary && `Summary: ${entity.summary}`,
    entity.bio && `Bio / backstory: ${entity.bio}`,
    entity.naicsCodes?.length ? `NAICS: ${entity.naicsCodes.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function opportunityBlock(o: FundingOpportunity): string {
  const days = daysUntil(o.deadline);
  const reqs = o.requiredDocuments.map((d) => DOCUMENT_LABELS[d] ?? d).join(", ") || "not specified";
  return [
    `Grant: "${o.opportunityName}" from ${o.fundingOrganization}.`,
    `Program type: ${o.programType.replace(/_/g, " ")}; award type: ${o.awardType.replace(/_/g, " ")}.`,
    o.fundingAmount ? `Amount: $${o.fundingAmount.toLocaleString()}.` : "",
    o.deadline ? `Deadline: ${o.deadline.slice(0, 10)}${days !== null ? ` (${days} days out)` : ""}.` : "Rolling deadline.",
    `Strategic lane: ${o.strategicLane.replace(/_/g, " ")}.`,
    `Required documents: ${reqs}.`,
    o.allieNotes && `ALLIE research notes: ${o.allieNotes}`,
    o.cappoNotes && `CAPPO governance notes: ${o.cappoNotes}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export interface AssistantContext {
  opp: FundingOpportunity;
  entity: EntityProfile | undefined;
  knowledge?: string; // the applicant entity's Drive documents
  priorCopy?: string; // previously-written grant copy across applications
}

function contextBlock(ctx: AssistantContext): string {
  return [
    "=== THIS GRANT (authoritative — answers must fit THIS funder) ===",
    opportunityBlock(ctx.opp),
    "",
    "=== APPLICANT ===",
    entityBlock(ctx.entity, ctx.opp.bestApplicantEntity),
    ctx.knowledge ? "\n=== APPLICANT DOCUMENTS (from the entity's Drive knowledge folder) ===\n" + ctx.knowledge : "",
    ctx.priorCopy
      ? "\n=== PREVIOUSLY-SUBMITTED GRANT COPY (style/substance reference only) ===\n" +
        "Reuse proven language and facts where they fit, but the CURRENT grant above governs — never copy a claim that doesn't apply here.\n" +
        ctx.priorCopy
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const RULES = [
  "Rules for every answer:",
  "- Write the actual answer a reviewer would read — no preamble, no 'Here is', no markdown headings.",
  "- Ground every answer ONLY in the context provided. Do NOT invent revenue, headcount, dates, awards, or credentials.",
  "- Where a specific figure is genuinely required but unknown, use a clearly-marked placeholder like [insert FY24 revenue].",
  "- Professional, confident, funder-appropriate tone. This is a DRAFT for a founder to review and edit before any human submits it.",
  'Return ONLY strict JSON of the form {"questions":[{"question":"...","answer":"..."}]} — no prose outside the JSON.',
].join("\n");

/** Parse the model's JSON payload defensively into a Q&A list. */
function parseQA(text: string): DraftedQA[] {
  if (!text) return [];
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as { questions?: unknown };
    if (!Array.isArray(obj.questions)) return [];
    return obj.questions
      .map((q) => {
        const item = q as { question?: unknown; answer?: unknown };
        return {
          question: typeof item.question === "string" ? item.question.trim() : "",
          answer: typeof item.answer === "string" ? item.answer.trim() : "",
        };
      })
      .filter((q) => q.question.length > 0);
  } catch {
    return [];
  }
}

/**
 * Read a screenshot of one grant-application page, extract its questions/fields, and
 * draft an answer for each. Returns [] if AI is unconfigured or on any failure.
 */
export async function analyzeScreenshotToQA(
  imageBase64: string,
  mediaType: ImageMediaType,
  ctx: AssistantContext,
): Promise<DraftedQA[]> {
  const ai = anthropic();
  if (!ai) return [];
  const prompt = [
    "You are Cappo, AMG's operations engine. The attached image is a screenshot of ONE page of a grant application.",
    "Identify EVERY question, prompt, or free-text field a human must fill in on this page (ignore navigation, logos, and instructions that don't require an answer).",
    "For each one, write the best draft answer for THIS applicant and THIS grant, using the context below.",
    "",
    contextBlock(ctx),
    "",
    RULES,
  ].join("\n");
  try {
    const resp = await ai.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            { type: "text", text: prompt },
          ],
        },
      ],
    });
    const text = resp.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return parseQA(text);
  } catch (e) {
    console.error("[grantops] screenshot analysis failed:", e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Draft answers to a set of already-known application questions (no screenshot).
 * Returns [] if AI is unconfigured, there are no questions, or on any failure.
 */
export async function draftAnswersForKnownQuestions(
  questions: string[],
  ctx: AssistantContext,
): Promise<DraftedQA[]> {
  const ai = anthropic();
  const cleaned = questions.map((q) => q.trim()).filter(Boolean);
  if (!ai || cleaned.length === 0) return [];
  const prompt = [
    "You are Cappo, AMG's operations engine, drafting answers to the following grant-application questions for a founder to review.",
    "",
    "QUESTIONS:",
    ...cleaned.map((q, i) => `${i + 1}. ${q}`),
    "",
    contextBlock(ctx),
    "",
    "Answer every question above, echoing each question verbatim in the JSON.",
    RULES,
  ].join("\n");
  try {
    const resp = await ai.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const text = resp.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const qa = parseQA(text);
    return qa.length ? qa : cleaned.map((q) => ({ question: q, answer: "" }));
  } catch (e) {
    console.error("[grantops] known-question drafting failed:", e instanceof Error ? e.message : e);
    return cleaned.map((q) => ({ question: q, answer: "" }));
  }
}

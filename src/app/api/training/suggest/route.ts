import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { createCapture } from "@/lib/connectors/notionWiki";

const SYSTEM = `You are a brand language assistant for Apex Meridian Group (AMG) / HVN.
Given a natural language description of a term, extract structured fields in JSON.
Return ONLY valid JSON with these exact keys:
{
  "term": "The term name",
  "meaning": "Formal definition",
  "use": "When/how to use this term",
  "plain": "Plain English meaning",
  "example": "A single example sentence",
  "category": "One of: Sanctum | Atmos Chambers | Prime Anchors | Tempering Reservoirs | Ember Lines | Product Formats | Brand Language"
}`;

function getClaudeClient(): Anthropic {
  const key = env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");
  return new Anthropic({ apiKey: key });
}

interface ExtractedTerm {
  term: string;
  meaning: string;
  use: string;
  plain: string;
  example: string;
  category: string;
}

async function extractTerm(input: string): Promise<ExtractedTerm> {
  const claude = getClaudeClient();
  const msg = await claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM,
    messages: [{ role: "user", content: input }],
  });
  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(cleaned) as ExtractedTerm;
}

async function createLexiconProposal(t: ExtractedTerm, rawInput: string): Promise<void> {
  await createCapture({
    title: `Lexicon proposal: ${t.term}`,
    type: "Terminology",
    notes: [
      "Governance note: this is a CAPPO Quiz suggestion, not an approved lexicon term.",
      "Route through AMGPx lexicon review before adding to the Lexicon Official Database.",
      "",
      `Proposed term: ${t.term}`,
      `Category: ${t.category}`,
      `Meaning: ${t.meaning}`,
      `Use: ${t.use}`,
      `Plain meaning: ${t.plain}`,
      `Example: ${t.example}`,
      "",
      "Original learner input:",
      rawInput,
    ].join("\n"),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input: string = typeof body?.input === "string" ? body.input.trim() : "";
    if (!input) {
      return NextResponse.json({ ok: false, error: "input is required" }, { status: 400 });
    }

    const extracted = await extractTerm(input);
    await createLexiconProposal(extracted, input);

    return NextResponse.json({ ok: true, term: extracted.term, status: "queued_for_review" });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error });
  }
}

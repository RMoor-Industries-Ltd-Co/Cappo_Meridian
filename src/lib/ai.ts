import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

/** Shared Claude client + config for the AI research module. */

export const AI_MODEL = "claude-opus-4-8";

export const AI_SYSTEM_PROMPT = `You are the AI research assistant for Apex Meridian Group (AMG), embedded in the Cappo Meridian operations dashboard.

You help the AMG partners with research, analysis, drafting, and decision support across the business: marketing, sales, inventory, affiliates, budget, operations, legal, and strategy.

Guidelines:
- Be direct, concrete, and well-organized. Lead with the answer, then support it.
- When you make factual claims that could be time-sensitive or uncertain, say so plainly.
- Prefer structured output (short sections, tables, bullet lists) for anything multi-part.
- Keep a professional, collaborative tone.`;

let client: Anthropic | null = null;

/** Returns the Anthropic client, or null if no API key is configured. */
export function getAi(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { env } from "@/lib/env";

/** Shared config + multi-provider backend for the AI research module. */

export const AI_SYSTEM_PROMPT = `You are the AI research assistant for Apex Meridian Group (AMG), embedded in the Cappo Meridian operations dashboard.

You help the AMG partners with research, analysis, drafting, and decision support across the business: marketing, sales, inventory, affiliates, budget, operations, legal, and strategy.

Guidelines:
- Be direct, concrete, and well-organized. Lead with the answer, then support it.
- When you make factual claims that could be time-sensitive or uncertain, say so plainly.
- Prefer structured output (short sections, tables, bullet lists) for anything multi-part.
- Keep a professional, collaborative tone.`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** A switchable AI backend (Claude, GPT, …) exposed on the AI page. */
export interface AiProvider {
  id: string;
  label: string;
  model: string;
  isConfigured(): boolean;
  /** Stream a completion, invoking onDelta for each text chunk. */
  streamChat(messages: ChatMessage[], onDelta: (text: string) => void): Promise<void>;
}

// ── Claude (Anthropic) ───────────────────────────────────────────
const CLAUDE_MODEL = "claude-opus-4-8";
let anthropic: Anthropic | null = null;

const claudeProvider: AiProvider = {
  id: "claude",
  label: "Claude",
  model: CLAUDE_MODEL,
  isConfigured: () => Boolean(env.ANTHROPIC_API_KEY),
  async streamChat(messages, onDelta) {
    if (!anthropic) anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const run = anthropic.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system: AI_SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    run.on("text", (delta) => onDelta(delta));
    await run.finalMessage();
  },
};

// ── GPT (OpenAI) ─────────────────────────────────────────────────
const OPENAI_MODEL = env.OPENAI_MODEL || "gpt-4o";
let openai: OpenAI | null = null;

const openaiProvider: AiProvider = {
  id: "openai",
  label: "GPT (OpenAI)",
  model: OPENAI_MODEL,
  isConfigured: () => Boolean(env.OPENAI_API_KEY),
  async streamChat(messages, onDelta) {
    if (!openai) openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const stream = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      stream: true,
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) onDelta(delta);
    }
  },
};

export const aiProviders: AiProvider[] = [claudeProvider, openaiProvider];
export const defaultProviderId = "claude";

/** Resolve a provider by id, falling back to the default (then any configured). */
export function getProvider(id?: string): AiProvider {
  return (
    aiProviders.find((p) => p.id === id) ??
    aiProviders.find((p) => p.id === defaultProviderId) ??
    aiProviders[0]
  );
}

/** Public, secret-free view of the providers for the client selector. */
export function providerOptions() {
  return aiProviders.map((p) => ({
    id: p.id,
    label: p.label,
    model: p.model,
    configured: p.isConfigured(),
  }));
}

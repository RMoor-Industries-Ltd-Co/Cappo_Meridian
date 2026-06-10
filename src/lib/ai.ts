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

/** A switchable AI backend (Claude, GPT, Base44 superagent, …) on the AI page. */
export interface AiProvider {
  id: string;
  label: string;
  model: string;
  /** Env var the user must set to enable this provider (shown when unconfigured). */
  envHint: string;
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
  envHint: "ANTHROPIC_API_KEY",
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
  envHint: "OPENAI_API_KEY",
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

// ── Base44 superagent (HTTPS endpoint bridge) ────────────────────
// Base44 has no external API-key invocation, so the user exposes their
// superagent as a Base44 backend function (service role) at an HTTPS URL.
// Contract — POST { system, messages: [{role,content}] } with optional
// `Authorization: Bearer <token>`; respond with either streamed text
// (Content-Type text/plain) or JSON { text: "..." }.
const base44Provider: AiProvider = {
  id: "base44",
  label: "Base44 Superagent",
  model: env.BASE44_AGENT_MODEL || "superagent",
  envHint: "BASE44_AGENT_URL",
  isConfigured: () => Boolean(env.BASE44_AGENT_URL),
  async streamChat(messages, onDelta) {
    const res = await fetch(env.BASE44_AGENT_URL as string, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.BASE44_AGENT_TOKEN ? { Authorization: `Bearer ${env.BASE44_AGENT_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        system: AI_SYSTEM_PROMPT,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Base44 agent ${res.status}: ${detail.slice(0, 200) || res.statusText}`);
    }

    const ctype = res.headers.get("content-type") ?? "";
    if (res.body && (ctype.includes("text/plain") || ctype.includes("text/event-stream"))) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        onDelta(dec.decode(value, { stream: true }));
      }
      return;
    }

    // JSON response — surface the first text-bearing field.
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const text =
      data &&
      (data.text ?? data.reply ?? data.response ?? data.output ?? data.content ?? data.message);
    onDelta(typeof text === "string" ? text : text ? JSON.stringify(text) : "(empty response)");
  },
};

export const aiProviders: AiProvider[] = [claudeProvider, base44Provider, openaiProvider];
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

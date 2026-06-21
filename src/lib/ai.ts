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

/** A selectable model within a provider (e.g. Perplexity's Sonar family). */
export interface AiModelOption {
  id: string;
  label: string;
}

/** A switchable AI backend (Claude, Perplexity, GPT, …) on the AI page. */
export interface AiProvider {
  id: string;
  label: string;
  model: string; // default model id
  envHint: string; // env var to set to enable it
  models?: AiModelOption[]; // selectable models (powers the sub-selector)
  isConfigured(): boolean;
  /** Stream a completion; `model` overrides the provider default when supported. */
  streamChat(messages: ChatMessage[], onDelta: (text: string) => void, model?: string): Promise<void>;
}

const withSystem = (messages: ChatMessage[]) => [
  { role: "system" as const, content: AI_SYSTEM_PROMPT },
  ...messages.map((m) => ({ role: m.role, content: m.content })),
];

// ── Claude (Anthropic) ───────────────────────────────────────────
const CLAUDE_DEFAULT_MODEL = env.CLAUDE_MODEL || "claude-sonnet-4-6";
const CLAUDE_MODELS: AiModelOption[] = [
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6 (default)" },
  { id: "claude-opus-4-8", label: "Opus 4.8 (most capable)" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5 (fastest)" },
];
// Claude Code reserves ANTHROPIC_API_KEY (won't inject it into the container),
// so also accept CLAUDE_API_KEY for dev validation. Production uses ANTHROPIC_API_KEY.
const claudeKey = () => env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY;
let anthropic: Anthropic | null = null;

const claudeProvider: AiProvider = {
  id: "claude",
  label: "Claude",
  model: CLAUDE_DEFAULT_MODEL,
  envHint: "ANTHROPIC_API_KEY (or CLAUDE_API_KEY in Claude Code)",
  models: CLAUDE_MODELS,
  isConfigured: () => Boolean(claudeKey()),
  async streamChat(messages, onDelta, model) {
    if (!anthropic) anthropic = new Anthropic({ apiKey: claudeKey() });
    const run = anthropic.messages.stream({
      model: model || CLAUDE_DEFAULT_MODEL,
      max_tokens: 8000,
      system: AI_SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    run.on("text", (delta) => onDelta(delta));
    await run.finalMessage();
  },
};

// ── Perplexity (OpenAI-compatible) — with its own model switcher ──
const PERPLEXITY_MODELS: AiModelOption[] = [
  { id: "sonar", label: "Sonar" },
  { id: "sonar-pro", label: "Sonar Pro" },
  { id: "sonar-reasoning-pro", label: "Sonar Reasoning Pro" },
  { id: "sonar-deep-research", label: "Sonar Deep Research" },
];
const PERPLEXITY_DEFAULT = env.PERPLEXITY_MODEL || "sonar-pro";
let perplexity: OpenAI | null = null;

const perplexityProvider: AiProvider = {
  id: "perplexity",
  label: "Perplexity",
  model: PERPLEXITY_DEFAULT,
  envHint: "PERPLEXITY_API_KEY",
  models: PERPLEXITY_MODELS,
  isConfigured: () => Boolean(env.PERPLEXITY_API_KEY),
  async streamChat(messages, onDelta, model) {
    if (!perplexity) {
      perplexity = new OpenAI({ apiKey: env.PERPLEXITY_API_KEY, baseURL: "https://api.perplexity.ai" });
    }
    const stream = await perplexity.chat.completions.create({
      model: model || PERPLEXITY_DEFAULT,
      stream: true,
      messages: withSystem(messages),
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) onDelta(delta);
    }
  },
};

// ── GPT (OpenAI) ─────────────────────────────────────────────────
const OPENAI_DEFAULT_MODEL = env.OPENAI_MODEL || "gpt-4o";
const OPENAI_MODELS: AiModelOption[] = [
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4o-mini", label: "GPT-4o mini (faster)" },
  { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { id: "o1", label: "o1 (reasoning)" },
  { id: "o3", label: "o3" },
];
let openai: OpenAI | null = null;

const openaiProvider: AiProvider = {
  id: "openai",
  label: "GPT (OpenAI)",
  model: OPENAI_DEFAULT_MODEL,
  envHint: "OPENAI_API_KEY",
  models: OPENAI_MODELS,
  isConfigured: () => Boolean(env.OPENAI_API_KEY),
  async streamChat(messages, onDelta, model) {
    if (!openai) openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const stream = await openai.chat.completions.create({
      model: model || OPENAI_DEFAULT_MODEL,
      stream: true,
      messages: withSystem(messages),
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) onDelta(delta);
    }
  },
};

export const aiProviders: AiProvider[] = [claudeProvider, perplexityProvider, openaiProvider];
export const defaultProviderId = "claude";

/** Resolve a provider by id, falling back to the default (then any configured). */
export function getProvider(id?: string): AiProvider {
  return (
    aiProviders.find((p) => p.id === id) ??
    aiProviders.find((p) => p.id === defaultProviderId) ??
    aiProviders[0]
  );
}

/** Validate a requested model id against a provider's selectable list. */
export function resolveModel(provider: AiProvider, model?: string): string | undefined {
  return provider.models?.some((m) => m.id === model) ? model : undefined;
}

/** Public, secret-free view of the providers (+ their models) for the client. */
export function providerOptions() {
  return aiProviders.map((p) => ({
    id: p.id,
    label: p.label,
    model: p.model,
    configured: p.isConfigured(),
    models: p.models ?? [],
  }));
}

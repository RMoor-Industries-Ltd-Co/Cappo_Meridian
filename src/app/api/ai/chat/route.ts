import { type NextRequest, NextResponse } from "next/server";
import { AI_MODEL, AI_SYSTEM_PROMPT, getAi, type ChatMessage } from "@/lib/ai";
import { addMessage } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/ai/chat — streams a Claude response as plain-text chunks.
 * Body: { messages: { role: "user"|"assistant", content: string }[] }
 */
export async function POST(req: NextRequest) {
  const ai = getAi();
  if (!ai) {
    return NextResponse.json(
      { error: "AI is not configured (set ANTHROPIC_API_KEY)." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const messages = (body?.messages ?? []) as ChatMessage[];
  const projectId = typeof body?.projectId === "string" ? body.projectId : null;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  // Persist the latest user turn immediately (best-effort) when in a project.
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (projectId && lastUser) {
    addMessage(projectId, "user", lastUser.content).catch(() => {});
  }

  // Trim to the last 40 turns to bound context.
  const recent = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .slice(-40)
    .map((m) => ({ role: m.role, content: m.content }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const run = ai.messages.stream({
          model: AI_MODEL,
          max_tokens: 8000,
          thinking: { type: "adaptive" },
          system: AI_SYSTEM_PROMPT,
          messages: recent,
        });
        let full = "";
        run.on("text", (delta) => {
          full += delta;
          controller.enqueue(encoder.encode(delta));
        });
        await run.finalMessage();
        // Persist the assistant reply (best-effort) when in a project.
        if (projectId && full) addMessage(projectId, "assistant", full).catch(() => {});
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`\n\n⚠️ ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

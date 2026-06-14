import { type NextRequest, NextResponse } from "next/server";
import { type ChatMessage, getProvider, resolveModel } from "@/lib/ai";
import { addMessage } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/ai/chat — streams an AI response as plain-text chunks.
 * Body: { messages: {role,content}[], provider?: "claude"|"openai", projectId?: string }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const messages = (body?.messages ?? []) as ChatMessage[];
  const projectId = typeof body?.projectId === "string" ? body.projectId : null;
  const provider = getProvider(typeof body?.provider === "string" ? body.provider : undefined);
  const model = resolveModel(provider, typeof body?.model === "string" ? body.model : undefined);

  if (!provider.isConfigured()) {
    return NextResponse.json(
      { error: `${provider.label} is not configured (set ${provider.envHint}).` },
      { status: 503 },
    );
  }
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
        let full = "";
        await provider.streamChat(
          recent,
          (delta) => {
            full += delta;
            controller.enqueue(encoder.encode(delta));
          },
          model,
        );
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

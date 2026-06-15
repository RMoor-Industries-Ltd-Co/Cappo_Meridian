import { type NextRequest, NextResponse } from "next/server";
import type { ChatMessage } from "@/lib/ai";
import { runCappoAgentChat } from "@/lib/agent";
import { addMessage } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/ai/act — agentic turn. Cappo can use its tools (ClickUp read/create/update in the
 * AMG space) to actually DO what the partner asks, then returns the final answer (non-streamed,
 * since tool-use loops don't stream cleanly). Body: { messages: {role,content}[], projectId? }.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const messages = (body?.messages ?? []) as ChatMessage[];
  const projectId = typeof body?.projectId === "string" ? body.projectId : null;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (projectId && lastUser) addMessage(projectId, "user", lastUser.content).catch(() => {});

  try {
    const reply = await runCappoAgentChat(messages);
    if (projectId && reply) addMessage(projectId, "assistant", reply).catch(() => {});
    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

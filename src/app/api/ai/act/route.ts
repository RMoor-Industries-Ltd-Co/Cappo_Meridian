import { type NextRequest, NextResponse } from "next/server";
import type { ChatMessage } from "@/lib/ai";
import { runCappoAgentChat, type AttachmentBlock } from "@/lib/agent";
import { addMessage } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/ai/act — agentic turn for Cappo (Claude tool-use path).
 * Body: { messages: {role,content}[], projectId?, model?, attachmentBlocks? }
 * attachmentBlocks carry multimodal content (images, PDFs, code) for the last user message.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const messages = (body?.messages ?? []) as ChatMessage[];
  const projectId = typeof body?.projectId === "string" ? body.projectId : null;
  const model = typeof body?.model === "string" ? body.model : undefined;
  const attachmentBlocks = Array.isArray(body?.attachmentBlocks)
    ? (body.attachmentBlocks as AttachmentBlock[])
    : undefined;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (projectId && lastUser) addMessage(projectId, "user", lastUser.content).catch(() => {});

  try {
    const reply = await runCappoAgentChat(messages, { model, attachmentBlocks });
    if (projectId && reply) addMessage(projectId, "assistant", reply).catch(() => {});
    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

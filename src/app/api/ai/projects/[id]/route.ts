import { type NextRequest, NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/env";
import { deleteProject, listMessages } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/ai/projects/:id — messages for a project. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ messages: [] });
  const { id } = await params;
  const messages = await listMessages(id);
  return NextResponse.json({ messages });
}

/** DELETE /api/ai/projects/:id — remove a project and its messages. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Persistence not configured" }, { status: 503 });
  }
  const { id } = await params;
  await deleteProject(id);
  return NextResponse.json({ ok: true });
}

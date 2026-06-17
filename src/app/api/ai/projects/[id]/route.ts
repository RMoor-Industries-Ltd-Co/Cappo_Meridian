import { type NextRequest, NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/env";
import { deleteProject, listMessages, renameProject } from "@/lib/db";

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

/** PATCH /api/ai/projects/:id — rename a project. Body: { name: string }. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Persistence not configured" }, { status: 503 });
  }
  const { id } = await params;
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  const project = await renameProject(id, name.trim());
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ project });
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

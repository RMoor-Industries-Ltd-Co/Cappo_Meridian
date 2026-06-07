import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAuthConfigured, isDbConfigured } from "@/lib/env";
import { createProject, listProjects } from "@/lib/db";

export const dynamic = "force-dynamic";

async function currentEmail(): Promise<string | null> {
  if (!isAuthConfigured()) return null;
  const session = await auth();
  return session?.user?.email ?? null;
}

/** GET /api/ai/projects — list research projects (workspace-shared). */
export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ persistent: false, projects: [] });
  const projects = await listProjects();
  return NextResponse.json({ persistent: true, projects });
}

/** POST /api/ai/projects — { name } create a project. */
export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Persistence not configured" }, { status: 503 });
  }
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  const project = await createProject(name.trim(), await currentEmail());
  return NextResponse.json({ project });
}

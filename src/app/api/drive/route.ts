import { type NextRequest, NextResponse } from "next/server";
import { isGoogleConfigured } from "@/lib/env";
import {
  driveBreadcrumbs,
  driveCreateDoc,
  driveCreateFolder,
  driveList,
  driveRename,
  driveTrash,
  isNotConnected,
} from "@/lib/connectors/driveFs";

export const dynamic = "force-dynamic";

function notConnected() {
  return NextResponse.json({ connected: false, error: "Google Drive not connected" }, { status: 409 });
}

/** GET /api/drive?parent=<id> — list a folder + breadcrumbs. */
export async function GET(req: NextRequest) {
  if (!isGoogleConfigured()) {
    return NextResponse.json({ configured: false, connected: false, items: [], breadcrumbs: [] });
  }
  const parent = req.nextUrl.searchParams.get("parent") || "root";
  try {
    const [items, breadcrumbs] = await Promise.all([
      driveList(parent),
      driveBreadcrumbs(parent),
    ]);
    return NextResponse.json({ configured: true, connected: true, items, breadcrumbs });
  } catch (err) {
    if (isNotConnected(err)) {
      return NextResponse.json({ configured: true, connected: false, items: [], breadcrumbs: [] });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

/** POST /api/drive — { action: "folder" | "doc", name, parent }. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { action, name, parent = "root" } = body as {
    action?: string;
    name?: string;
    parent?: string;
  };
  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  try {
    const item =
      action === "doc"
        ? await driveCreateDoc(name.trim(), parent)
        : await driveCreateFolder(name.trim(), parent);
    return NextResponse.json({ item });
  } catch (err) {
    if (isNotConnected(err)) return notConnected();
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

/** PATCH /api/drive — { id, name } rename. */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { id, name } = body as { id?: string; name?: string };
  if (!id || !name?.trim()) {
    return NextResponse.json({ error: "id and name are required" }, { status: 400 });
  }
  try {
    const item = await driveRename(id, name.trim());
    return NextResponse.json({ item });
  } catch (err) {
    if (isNotConnected(err)) return notConnected();
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

/** DELETE /api/drive?id=<id> — move to trash. */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  try {
    await driveTrash(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isNotConnected(err)) return notConnected();
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

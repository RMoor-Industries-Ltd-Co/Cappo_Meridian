import { type NextRequest, NextResponse } from "next/server";
import { driveUpload, isNotConnected } from "@/lib/connectors/driveFs";

export const dynamic = "force-dynamic";

/** POST /api/drive/upload — multipart form: file=<File>, parent=<folderId>. */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const parent = (form?.get("parent") as string) || "root";

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const item = await driveUpload(
      parent,
      file.name,
      file.type || "application/octet-stream",
      buffer,
    );
    return NextResponse.json({ item });
  } catch (err) {
    if (isNotConnected(err)) {
      return NextResponse.json({ error: "Google Drive not connected" }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

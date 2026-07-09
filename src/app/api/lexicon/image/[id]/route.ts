import { type NextRequest, NextResponse } from "next/server";
import { driveDownload, isNotConnected } from "@/lib/connectors/driveFs";

export const dynamic = "force-dynamic";

/**
 * GET /api/lexicon/image/{driveFileId} — streams a lexicon term image from
 * Google Drive using the app's shared credentials. This lets private Drive
 * files render on the dashboard without being publicly shared (the public
 * lh3.googleusercontent.com/d/{id} CDN only serves link-shared files, so it
 * redirected to a Google sign-in page and the images broke).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Drive file ids are URL-safe base64-ish; reject anything else.
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  try {
    const { body, mimeType } = await driveDownload(id);
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        // Immutable Drive file content keyed by id — cache hard at the edge.
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    });
  } catch (err) {
    if (isNotConnected(err)) {
      return NextResponse.json({ error: "Drive not connected" }, { status: 503 });
    }
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

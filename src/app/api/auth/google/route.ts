import { NextResponse } from "next/server";
import { isGoogleConfigured } from "@/lib/env";
import { buildAuthUrl } from "@/lib/connectors/google";

export const dynamic = "force-dynamic";

/** Kick off the Google OAuth consent flow (Drive + Gmail). */
export function GET() {
  if (!isGoogleConfigured()) {
    return NextResponse.json(
      { error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET." },
      { status: 400 },
    );
  }
  return NextResponse.redirect(buildAuthUrl());
}

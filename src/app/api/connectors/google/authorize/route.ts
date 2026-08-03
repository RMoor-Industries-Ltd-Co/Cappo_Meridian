import { type NextRequest, NextResponse } from "next/server";
import { isGoogleConfigured } from "@/lib/env";
import { buildAuthUrl } from "@/lib/connectors/google";
import { DEFAULT_ACCOUNT, isValidAccountKey } from "@/lib/connectors/googleTokens";

export const dynamic = "force-dynamic";

/**
 * Kick off the Google OAuth consent flow (Drive + Gmail + Sheets).
 *
 * `?account=` names which stored connection the result lands in, so a second
 * Workspace account can be added without evicting the first. Defaults to the
 * single shared connection.
 */
export function GET(req: NextRequest) {
  if (!isGoogleConfigured()) {
    return NextResponse.json(
      { error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET." },
      { status: 400 },
    );
  }
  const requested = req.nextUrl.searchParams.get("account") ?? DEFAULT_ACCOUNT;
  if (!isValidAccountKey(requested)) {
    return NextResponse.json({ error: "Invalid account key." }, { status: 400 });
  }
  return NextResponse.redirect(buildAuthUrl(requested));
}

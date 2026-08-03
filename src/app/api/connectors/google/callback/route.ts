import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createOAuthClient, saveTokens } from "@/lib/connectors/google";
import { DEFAULT_ACCOUNT, isValidAccountKey } from "@/lib/connectors/googleTokens";

export const dynamic = "force-dynamic";

/** OAuth redirect target — exchanges the code for tokens and stores them. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${env.APP_BASE_URL}/settings?google=denied`);
  }
  if (!code) {
    return NextResponse.redirect(`${env.APP_BASE_URL}/settings?google=missing_code`);
  }

  // Which connection this consent was for, round-tripped through OAuth `state`.
  // Validated rather than trusted — `state` comes back through the browser, so
  // an unchecked value would let a crafted link write to an arbitrary key.
  const state = req.nextUrl.searchParams.get("state");
  const account = state && isValidAccountKey(state) ? state : DEFAULT_ACCOUNT;

  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    await saveTokens(tokens, account);
    return NextResponse.redirect(`${env.APP_BASE_URL}/settings?google=connected`);
  } catch {
    return NextResponse.redirect(`${env.APP_BASE_URL}/settings?google=error`);
  }
}

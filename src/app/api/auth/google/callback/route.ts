import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createOAuthClient, saveTokens } from "@/lib/connectors/google";

export const dynamic = "force-dynamic";

/** OAuth redirect target — exchanges the code for tokens and stores them. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${env.APP_BASE_URL}/?google=denied`);
  }
  if (!code) {
    return NextResponse.redirect(`${env.APP_BASE_URL}/?google=missing_code`);
  }

  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    await saveTokens(tokens);
    return NextResponse.redirect(`${env.APP_BASE_URL}/?google=connected`);
  } catch {
    return NextResponse.redirect(`${env.APP_BASE_URL}/?google=error`);
  }
}

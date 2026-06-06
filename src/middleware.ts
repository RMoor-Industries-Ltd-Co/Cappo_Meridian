import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAuthConfigured } from "@/lib/env";

/**
 * Gate every page behind a signed-in AMG Workspace session.
 *
 * When auth isn't configured yet (no Google client / AUTH_SECRET — e.g. local
 * dev before secrets are set) the gate is bypassed so the app stays browsable.
 * Once configured (as in production), unauthenticated requests are redirected
 * to /signin.
 */
export default auth((req) => {
  if (!isAuthConfigured()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const isPublic =
    pathname === "/signin" ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/health";

  if (!req.auth && !isPublic) {
    const url = new URL("/signin", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

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
const protect = auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname === "/signin" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/apple-icon") ||
    pathname === "/api/health";

  if (!req.auth && !isPublic) {
    const url = new URL("/signin", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

// Only engage Auth.js when a secret is configured. Evaluating the `auth()`
// wrapper without a secret throws (MissingSecret) in production, so when
// unconfigured we fall back to a passthrough and the app stays browsable.
export default isAuthConfigured()
  ? protect
  : () => NextResponse.next();

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

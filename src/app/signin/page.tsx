import { redirect } from "next/navigation";
import { Starburst } from "@/components/brand/Starburst";
import { SignInButton } from "@/components/auth/SignInButton";
import { auth } from "@/auth";
import { env, isAuthConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;

  // Already signed in → go straight in.
  if (isAuthConfigured()) {
    const session = await auth();
    if (session) redirect(callbackUrl || "/");
  }

  return (
    <main className="amg-canvas flex min-h-screen items-center justify-center px-6">
      <div className="gold-pour" aria-hidden />
      <div className="panel panel-gold relative z-10 flex w-full max-w-sm flex-col items-center gap-6 p-8 text-center">
        <div className="text-gold">
          <Starburst size={44} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-fg">Cappo Meridian</h1>
          <p className="mt-1 text-sm text-subtle">
            Apex Meridian Group · internal operations
          </p>
        </div>

        {error && (
          <p className="w-full rounded-lg border border-neg/30 bg-neg/5 px-3 py-2 text-xs text-fg">
            {error === "AccessDenied"
              ? `Only @${env.GOOGLE_WORKSPACE_DOMAIN} accounts can sign in.`
              : "Sign-in failed. Please try again."}
          </p>
        )}

        {isAuthConfigured() ? (
          <SignInButton callbackUrl={callbackUrl || "/"} />
        ) : (
          <p className="w-full rounded-lg border border-border-strong bg-panel px-3 py-3 text-xs text-muted">
            Authentication isn&apos;t configured yet. Set{" "}
            <code className="text-gold">GOOGLE_CLIENT_ID</code>,{" "}
            <code className="text-gold">GOOGLE_CLIENT_SECRET</code>, and{" "}
            <code className="text-gold">AUTH_SECRET</code> to enable Google Workspace
            login.
          </p>
        )}

        <p className="text-[11px] text-subtle">
          Restricted to the {env.GOOGLE_WORKSPACE_DOMAIN} workspace.
        </p>
      </div>
    </main>
  );
}

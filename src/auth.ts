import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { env } from "@/lib/env";
import { FOUNDER_EMAILS } from "@/lib/founders";

/**
 * App authentication for Cappo_Meridian.
 *
 * Access is granted to any of:
 *   (a) Verified Google Workspace accounts on GOOGLE_WORKSPACE_DOMAIN, OR
 *   (b) Email addresses listed in PARTNER_EMAILS (comma-separated), OR
 *   (c) The two founder emails (FOUNDER_55_EMAIL / FOUNDER_88_EMAIL).
 *
 * The same Google OAuth client is reused for the Drive/Gmail connectors;
 * register both redirect URIs on it:
 *   - /api/auth/callback/google           (this login flow)
 *   - /api/connectors/google/callback     (connector authorization)
 */

const allowedEmails = new Set(
  [...(env.PARTNER_EMAILS ?? "").split(","), ...FOUNDER_EMAILS]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          // No `hd` hint — it causes Google to reject non-Workspace accounts
          // with invalid_request before our callback runs. Domain enforcement
          // is handled below in the signIn callback.
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      const email = (profile?.email ?? "").toLowerCase();
      const verified = profile?.email_verified === true;
      if (!verified || !email) return false;

      // Always allow explicitly listed partner + founder emails
      if (allowedEmails.has(email)) return true;

      // Allow verified accounts on the AMG Workspace domain
      const domain = env.GOOGLE_WORKSPACE_DOMAIN;
      const hostedDomain = (profile as { hd?: string } | undefined)?.hd;
      return hostedDomain === domain && email.endsWith(`@${domain.toLowerCase()}`);
    },
  },
});


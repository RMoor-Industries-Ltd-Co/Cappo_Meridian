import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { env } from "@/lib/env";

/**
 * App authentication for Cappo_Meridian.
 *
 * Sign-in is gated to the Apex Meridian Group Google Workspace — only verified
 * accounts on GOOGLE_WORKSPACE_DOMAIN may enter. Sessions are JWT-based (no
 * database required). The same Google OAuth client is reused for the Drive/Gmail
 * connectors; register both redirect URIs on it:
 *   - /api/auth/callback/google           (this login flow)
 *   - /api/connectors/google/callback     (connector authorization)
 */
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
          hd: env.GOOGLE_WORKSPACE_DOMAIN, // hint the AMG workspace
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    /** Hard domain gate — defense beyond the `hd` hint, which is not enforced. */
    signIn({ profile }) {
      const domain = env.GOOGLE_WORKSPACE_DOMAIN;
      const email = profile?.email ?? "";
      const verified = profile?.email_verified === true;
      const hostedDomain = (profile as { hd?: string } | undefined)?.hd;
      return (
        verified &&
        hostedDomain === domain &&
        email.toLowerCase().endsWith(`@${domain.toLowerCase()}`)
      );
    },
  },
});

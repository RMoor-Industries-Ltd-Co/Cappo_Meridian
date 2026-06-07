"use server";

import { signOut } from "@/auth";

/** Server-side sign-out — clears the session cookie and redirects to /signin. */
export async function signOutAction() {
  await signOut({ redirectTo: "/signin" });
}

import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { auth } from "@/auth";
import { isAuthConfigured } from "@/lib/env";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = isAuthConfigured() ? await auth() : null;
  const user = session?.user
    ? { name: session.user.name, email: session.user.email, image: session.user.image }
    : null;

  return <AppShell user={user}>{children}</AppShell>;
}

"use client";

import { type ReactNode, useState } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { MobileDrawer } from "@/components/shell/MobileDrawer";

interface ShellUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

/**
 * Below `md` the icon rail (Sidebar) hides and nav moves into a drawer
 * opened from the Topbar's hamburger — a client component owns that shared
 * open/close state since Sidebar and Topbar are siblings under the (dash)
 * server-component layout.
 */
export function AppShell({ user, children }: { user?: ShellUser | null; children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="amg-canvas flex h-dvh overflow-hidden">
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setDrawerOpen(true)} />
        <main className="relative flex-1 overflow-y-auto">
          {/* Poured-gold accent cascading from the top of the canvas */}
          <div className="gold-pour" aria-hidden />
          <div className="relative z-10 mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
            {children}
          </div>
        </main>
      </div>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} />
    </div>
  );
}

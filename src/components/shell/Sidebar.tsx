"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Settings, LifeBuoy, LogOut } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { AmgMark } from "@/components/brand/AmgLogo";

interface SidebarUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export function Sidebar({ user }: { user?: SidebarUser | null }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-border bg-[var(--bg-elevated)]/60 py-4">
      <Link href="/" className="mb-4 text-gold" title="Cappo Meridian · Apex Meridian Group">
        <AmgMark size={30} />
      </Link>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`group relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                active
                  ? "bg-gold/15 text-gold"
                  : "text-subtle hover:bg-white/5 hover:text-muted"
              }`}
            >
              {active && (
                <span className="absolute left-[-12px] h-5 w-1 rounded-full bg-gold shadow-[0_0_10px_var(--gold-glow)]" />
              )}
              <Icon size={19} strokeWidth={1.75} />
              <span className="pointer-events-none absolute left-12 z-50 hidden whitespace-nowrap rounded-md border border-border bg-panel px-2 py-1 text-xs text-muted group-hover:block">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col items-center gap-1">
        <button
          className="flex h-10 w-10 items-center justify-center rounded-xl text-subtle hover:bg-white/5 hover:text-muted"
          title="Support"
        >
          <LifeBuoy size={19} strokeWidth={1.75} />
        </button>
        <Link
          href="/settings"
          title="Settings"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-subtle hover:bg-white/5 hover:text-muted"
        >
          <Settings size={19} strokeWidth={1.75} />
        </Link>

        {user ? (
          <div className="group relative mt-1">
            <button
              className="block h-8 w-8 overflow-hidden rounded-full ring-1 ring-border-strong"
              title={user.email ?? user.name ?? "Account"}
            >
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name ?? "Account"}
                  width={32}
                  height={32}
                  className="h-8 w-8 object-cover"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-gold-bright to-gold-deep text-xs font-semibold text-[#2a1f06]">
                  {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
                </span>
              )}
            </button>
            <div className="pointer-events-none absolute bottom-0 left-12 z-50 hidden w-48 flex-col gap-2 rounded-lg border border-border bg-panel p-3 group-hover:flex group-hover:pointer-events-auto">
              <p className="truncate text-xs text-muted">{user.email}</p>
              <button
                onClick={() => signOut({ callbackUrl: "/signin" })}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-fg hover:bg-white/5"
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-1 h-8 w-8 rounded-full bg-gradient-to-br from-gold-bright to-gold-deep" />
        )}
      </div>
    </aside>
  );
}

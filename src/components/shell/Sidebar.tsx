"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Settings, LogOut } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { AmgMark } from "@/components/brand/AmgLogo";
import { signOutAction } from "@/lib/actions/auth";
import { MeetingHighlight } from "@/components/shell/MeetingHighlight";

interface SidebarUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export function Sidebar({ user }: { user?: SidebarUser | null }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isTouch, setIsTouch] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(hover: none) and (pointer: coarse)").matches
      : false,
  );
  const [openHighlight, setOpenHighlight] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (openHighlight !== null) setOpenHighlight(null);
  }

  useEffect(() => {
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    const onChange = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!openHighlight) return;
    const closeIfOutside = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpenHighlight(null);
    };
    document.addEventListener("click", closeIfOutside);
    return () => document.removeEventListener("click", closeIfOutside);
  }, [openHighlight]);

  return (
    <aside className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-border bg-[var(--bg-elevated)]/60 py-4">
      <Link href="/" className="mb-4 text-gold" title="Cappo Meridian · Apex Meridian Group">
        <AmgMark size={30} />
      </Link>

      <nav ref={navRef} className="flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          const flyoutOpen = item.highlight && openHighlight === item.href;
          return (
            <div key={item.href} className="group relative">
              <Link
                href={item.href}
                title={item.label}
                onClick={(e) => {
                  if (item.highlight && isTouch && !flyoutOpen) {
                    e.preventDefault();
                    setOpenHighlight(item.href);
                  }
                }}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                  active
                    ? "bg-gold/15 text-gold"
                    : "text-subtle hover:bg-white/5 hover:text-muted"
                }`}
              >
                {active && (
                  <span className="absolute left-[-12px] h-5 w-1 rounded-full bg-gold shadow-[0_0_10px_var(--gold-glow)]" />
                )}
                <Icon size={19} strokeWidth={1.75} />
              </Link>
              {item.highlight ? (
                <MeetingHighlight pathname={pathname} open={flyoutOpen} />
              ) : (
                <span className="pointer-events-none absolute left-12 top-0 z-50 hidden whitespace-nowrap rounded-md border border-border bg-panel px-2 py-1 text-xs text-muted group-hover:block">
                  {item.label}
                </span>
              )}
            </div>
          );
        })}
      </nav>

      <div className="flex flex-col items-center gap-1">
        <Link
          href="/settings"
          title="Settings"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-subtle hover:bg-white/5 hover:text-muted"
        >
          <Settings size={19} strokeWidth={1.75} />
        </Link>

        <div className="relative mt-1">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-border-strong focus:outline-none"
            title={user?.email ?? user?.name ?? "Account"}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            {user?.image && !imgError ? (
              <Image
                src={user.image}
                alt={user.name ?? "Account"}
                width={32}
                height={32}
                className="h-8 w-8 object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-gold-bright to-gold-deep text-xs font-semibold text-[#2a1f06]">
                {(user?.name ?? user?.email ?? "A").charAt(0).toUpperCase()}
              </span>
            )}
          </button>

          {menuOpen && (
            <>
              {/* click-away backdrop */}
              <button
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div className="absolute bottom-0 left-12 z-50 flex w-52 flex-col gap-2 rounded-lg border border-border bg-panel p-3 shadow-xl">
                {user ? (
                  <>
                    <p className="truncate text-xs text-muted">{user.email ?? user.name ?? "Signed in"}</p>
                    <form action={signOutAction}>
                      <button
                        type="submit"
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-fg hover:bg-white/5"
                      >
                        <LogOut size={14} /> Sign out
                      </button>
                    </form>
                  </>
                ) : (
                  <p className="text-xs text-muted">Not signed in</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, LogOut, Settings, Flame } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { AmgMark } from "@/components/brand/AmgLogo";
import { signOutAction } from "@/lib/actions/auth";

interface DrawerUser {
  name?: string | null;
  email?: string | null;
}

interface Highlight {
  title: string;
  meta: string;
  url: string;
}

/**
 * Full nav list for narrow (phone-width) screens — opened from the Topbar's
 * hamburger button since the icon-only rail (components/shell/Sidebar.tsx)
 * is hidden below `md`. With 14 sections, a bottom tab bar would crowd the
 * viewport; a slide-out drawer keeps the content full-width and puts nav one
 * tap away instead of permanently on screen.
 */
export function MobileDrawer({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user?: DrawerUser | null;
}) {
  const pathname = usePathname();
  const [highlight, setHighlight] = useState<Highlight | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/meetings/highlight?path=${encodeURIComponent(pathname)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setHighlight(json.highlight ?? null);
      })
      .catch(() => {
        if (!cancelled) setHighlight(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, pathname]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        aria-label="Close menu"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 md:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        className={`fixed left-0 top-0 z-50 flex h-dvh w-72 flex-col border-r border-border bg-[var(--bg-elevated)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-2xl transition-transform duration-200 md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <Link href="/" onClick={onClose} className="flex items-center gap-2 text-gold">
            <AmgMark size={26} />
            <span className="text-sm font-semibold text-fg">Cappo Meridian</span>
          </Link>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-subtle hover:bg-white/5 hover:text-muted"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <div key={item.href} className="mb-0.5">
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    active ? "bg-gold/15 text-gold" : "text-muted hover:bg-white/5 hover:text-fg"
                  }`}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  {item.label}
                </Link>
                {item.highlight && highlight && (
                  <a
                    href={highlight.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="ml-11 mr-3 mt-0.5 flex flex-col gap-0.5 rounded-md border border-gold/30 bg-panel px-2.5 py-1.5 text-xs"
                  >
                    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gold/70">
                      <Flame size={10} /> Top priority
                    </span>
                    <span className="line-clamp-1 text-fg">{highlight.title}</span>
                  </a>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-border px-2 py-2">
          <Link
            href="/settings"
            onClick={onClose}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-white/5 hover:text-fg"
          >
            <Settings size={18} strokeWidth={1.75} />
            Settings
          </Link>
          {user && (
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-white/5 hover:text-fg"
              >
                <LogOut size={18} strokeWidth={1.75} />
                Sign out
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

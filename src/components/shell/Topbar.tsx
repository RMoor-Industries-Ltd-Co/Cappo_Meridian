"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Bell, Plus, ChevronDown, CalendarClock, Menu } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const current =
    NAV_ITEMS.find((n) =>
      n.href === "/" ? pathname === "/" : pathname.startsWith(n.href),
    ) ?? NAV_ITEMS[0];

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-subtle hover:bg-white/5 hover:text-muted md:hidden"
      >
        <Menu size={20} />
      </button>

      <div className="flex items-baseline gap-3">
        <h1 className="text-lg font-semibold text-fg">{current.label}</h1>
        <span className="hidden text-xs text-subtle sm:inline">
          Apex Meridian Group
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <label className="hidden items-center gap-2 rounded-lg border border-border bg-panel px-3 py-2 text-sm text-muted md:flex">
          <Search size={15} className="text-subtle" />
          <input
            placeholder="Search…"
            className="w-40 bg-transparent text-fg placeholder:text-subtle focus:outline-none"
          />
        </label>

        <button className="hidden items-center gap-2 rounded-lg border border-border bg-panel px-3 py-2 text-sm text-muted hover:text-fg sm:flex">
          Branch Name
          <ChevronDown size={14} />
        </button>

        <Link
          href="/calendar"
          title="Calendar"
          className="hidden h-9 w-9 items-center justify-center rounded-lg border border-border bg-panel text-muted hover:text-fg sm:flex"
        >
          <CalendarClock size={16} />
        </Link>
        <button className="hidden h-9 w-9 items-center justify-center rounded-lg border border-border bg-panel text-muted hover:text-fg sm:flex">
          <Bell size={16} />
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-lg btn-gold">
          <Plus size={16} />
        </button>
      </div>
    </header>
  );
}

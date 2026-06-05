"use client";

import { usePathname } from "next/navigation";
import { Search, Bell, Plus, ChevronDown, CalendarClock } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";

export function Topbar() {
  const pathname = usePathname();
  const current =
    NAV_ITEMS.find((n) =>
      n.href === "/" ? pathname === "/" : pathname.startsWith(n.href),
    ) ?? NAV_ITEMS[0];

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border px-6">
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

        <button className="flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-2 text-sm text-muted hover:text-fg">
          Branch Name
          <ChevronDown size={14} />
        </button>

        <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-panel text-muted hover:text-fg">
          <CalendarClock size={16} />
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-panel text-muted hover:text-fg">
          <Bell size={16} />
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-lg btn-gold">
          <Plus size={16} />
        </button>
      </div>
    </header>
  );
}

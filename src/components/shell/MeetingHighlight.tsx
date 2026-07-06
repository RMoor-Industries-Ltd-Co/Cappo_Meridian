"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

interface Highlight {
  title: string;
  meta: string;
  url: string;
  kind: "task" | "action" | "meeting";
}

/**
 * Hover flyout for the Meetings nav item: the single highest-priority open
 * item (soonest-due ClickUp task, else an open Notion Action, else the most
 * recent meeting note) for whatever module the current page belongs to — see
 * lib/domainMap.ts + lib/meetingHighlight.ts. Renders as a sibling of the nav
 * Link (not nested inside it — Link is already an <a>).
 */
export function MeetingHighlight({ pathname }: { pathname: string }) {
  const [highlight, setHighlight] = useState<Highlight | null>(null);

  useEffect(() => {
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
  }, [pathname]);

  const content = highlight ?? {
    title: "Meetings",
    meta: "Review transcribed & logged conversations",
    url: "/meetings",
    kind: "meeting" as const,
  };

  return (
    <a
      href={content.url}
      target={highlight ? "_blank" : undefined}
      rel={highlight ? "noopener noreferrer" : undefined}
      className="pointer-events-none absolute left-12 top-0 z-50 hidden w-72 flex-col gap-1 rounded-lg border border-gold/40 bg-panel px-3 py-2.5 opacity-0 shadow-xl transition-all duration-200 group-hover:pointer-events-auto group-hover:flex group-hover:opacity-100"
    >
      {highlight && (
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gold/70">
          <Flame size={11} /> Top priority here
        </span>
      )}
      <span className="line-clamp-2 text-sm font-medium text-fg">{content.title}</span>
      <span className="text-xs text-subtle">{content.meta}</span>
    </a>
  );
}

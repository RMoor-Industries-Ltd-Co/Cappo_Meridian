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
 * Hover (desktop) / tap (touch) flyout for the Meetings nav item: the single
 * highest-priority open item (soonest-due ClickUp task, else an open Notion
 * Action, else the most recent meeting note) for whatever module the current
 * page belongs to — see lib/domainMap.ts + lib/meetingHighlight.ts. Renders
 * as a sibling of the nav Link (not nested inside it — Link is already an
 * <a>). On touch devices Sidebar drives visibility via `open` (first tap
 * opens the flyout instead of navigating; a second tap on the link inside it
 * navigates) since there's no hover state to trigger the CSS.
 */
export function MeetingHighlight({ pathname, open }: { pathname: string; open?: boolean }) {
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

  const base =
    "absolute left-12 top-0 z-50 w-72 flex-col gap-1 rounded-lg border border-gold/40 bg-panel px-3 py-2.5 shadow-xl transition-all duration-200";
  const hoverState =
    "hidden pointer-events-none opacity-0 group-hover:flex group-hover:pointer-events-auto group-hover:opacity-100";
  const openState = "flex pointer-events-auto opacity-100";

  return (
    <a
      href={content.url}
      target={highlight ? "_blank" : undefined}
      rel={highlight ? "noopener noreferrer" : undefined}
      className={`${base} ${open ? openState : hoverState}`}
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

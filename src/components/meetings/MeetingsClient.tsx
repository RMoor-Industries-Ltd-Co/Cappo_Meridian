"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Video } from "lucide-react";

interface MeetingNote {
  id: string;
  title: string;
  date: string | null;
  source: string;
  link: string | null;
  summary: string;
  url: string;
}

const SOURCE_ORDER = ["Fathom", "Gemini", "Calendly", "ClickUp", "Notion", "Other"];

export function MeetingsClient({ meetings, configured }: { meetings: MeetingNote[]; configured: boolean }) {
  const sources = useMemo(() => {
    const present = new Set(meetings.map((m) => m.source || "Other"));
    const ordered = SOURCE_ORDER.filter((s) => present.has(s));
    const extra = [...present].filter((s) => !SOURCE_ORDER.includes(s));
    return ["All", ...ordered, ...extra];
  }, [meetings]);

  const [activeSource, setActiveSource] = useState("All");

  const filtered =
    activeSource === "All" ? meetings : meetings.filter((m) => (m.source || "Other") === activeSource);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <h1 className="text-2xl font-semibold text-gold">Meetings</h1>
        <p className="mt-1 text-sm text-subtle">
          Transcribed & logged conversations — Fathom, Gemini, Calendly, ClickUp, and Notion, in one index.
        </p>
      </div>

      {!configured && (
        <div className="rounded-xl border border-border bg-panel px-4 py-3 text-sm text-subtle">
          No meeting source is connected yet — connect ClickUp or Notion in Settings → Integrations
          to pull transcribed meetings in.
        </div>
      )}

      {configured && (
        <>
          <div className="flex flex-wrap gap-2 border-b border-border pb-3">
            {sources.map((s) => (
              <button
                key={s}
                onClick={() => setActiveSource(s)}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  activeSource === s
                    ? "bg-gold/15 text-gold border border-gold/40"
                    : "border border-border bg-panel text-subtle hover:border-gold/30 hover:text-fg",
                ].join(" ")}
              >
                {s}
              </button>
            ))}
          </div>

          <p className="text-xs text-subtle">
            {filtered.length} {filtered.length === 1 ? "meeting" : "meetings"}
            {activeSource !== "All" ? ` from ${activeSource}` : ""}
          </p>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-border bg-panel px-4 py-8 text-center text-sm text-subtle">
              No meetings yet. ClickUp meeting docs appear here automatically; Notion rows show once
              added to the Meeting Notes database (Source + link + summary).
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {filtered.map((m) => (
                <a
                  key={m.id}
                  href={m.link || m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col gap-2 rounded-xl border border-border bg-panel px-4 py-3 transition-colors hover:border-gold/40 hover:bg-panel-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-semibold text-gold group-hover:text-gold-bright transition-colors">
                      {m.title}
                    </span>
                    <ExternalLink size={14} className="mt-0.5 shrink-0 text-subtle" />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <Video size={12} />
                    <span>{m.source || "Other"}</span>
                    {m.date && <span>· {new Date(m.date).toLocaleDateString()}</span>}
                  </div>
                  {m.summary && <p className="line-clamp-3 text-xs text-subtle">{m.summary}</p>}
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

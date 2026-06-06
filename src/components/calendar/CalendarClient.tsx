"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import {
  type CalEvent,
  type CalView,
  DAY_NAMES,
  HOURS,
  MONTH_NAMES,
  addDays,
  addMonths,
  fmtHour,
  fmtTime,
  hoursInto,
  isSameDay,
  isSameMonth,
  sampleEvents,
  startOfMonth,
  startOfWeek,
} from "@/lib/calendar";

const BASE_ROW = 52; // px per hour at 100% zoom
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

// Rendered client-only (via dynamic ssr:false), so reading `window` and
// `new Date()` in initializers is safe — no SSR hydration mismatch.
export default function CalendarClient() {
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [now, setNow] = useState<Date>(() => new Date());
  const [view, setView] = useState<CalView>(() => {
    const w = window.innerWidth;
    return w >= 1024 ? "month" : w >= 640 ? "week" : "day";
  });
  const [zoom, setZoom] = useState(1);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Tick the "now" indicator each minute.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const rowHeight = Math.round(BASE_ROW * zoom);

  // Scroll the time grid to ~7am when entering week/day or changing zoom.
  useEffect(() => {
    if (view === "month") return;
    const el = scrollRef.current;
    if (el) el.scrollTop = 7 * rowHeight - 8;
  }, [view, rowHeight]);

  // ⌘/Ctrl + wheel to zoom (native non-passive listener so preventDefault works).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom((z) => clampZoom(z - e.deltaY * 0.002));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [view]);

  const events = useMemo(() => {
    if (view === "month") {
      const first = startOfWeek(startOfMonth(cursor));
      return Array.from({ length: 6 }).flatMap((_, w) =>
        sampleEvents(addDays(first, w * 7)).map((e) => ({ ...e, id: `${e.id}-${w}` })),
      );
    }
    return sampleEvents(cursor);
  }, [view, cursor]);

  const go = (dir: number) => {
    if (view === "month") setCursor((c) => addMonths(c, dir));
    else if (view === "week") setCursor((c) => addDays(c, 7 * dir));
    else setCursor((c) => addDays(c, dir));
  };

  const title = useMemo(() => {
    if (view === "month") return `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
    if (view === "day")
      return cursor.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    const ws = startOfWeek(cursor);
    const we = addDays(ws, 6);
    const sameMonth = ws.getMonth() === we.getMonth();
    return `${MONTH_NAMES[ws.getMonth()].slice(0, 3)} ${ws.getDate()} – ${
      sameMonth ? "" : MONTH_NAMES[we.getMonth()].slice(0, 3) + " "
    }${we.getDate()}, ${we.getFullYear()}`;
  }, [view, cursor]);

  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => go(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-panel text-muted hover:text-fg"
            aria-label="Previous"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="rounded-lg border border-border bg-panel px-3 py-2 text-sm text-muted hover:text-fg"
          >
            Today
          </button>
          <button
            onClick={() => go(1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-panel text-muted hover:text-fg"
            aria-label="Next"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <h2 className="ml-1 min-w-0 flex-1 truncate text-lg font-semibold text-fg">
          {title}
        </h2>

        {/* Zoom */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-panel p-1">
          <button
            onClick={() => setZoom((z) => clampZoom(z - 0.25))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-white/5 hover:text-fg"
            aria-label="Zoom out"
          >
            <Minus size={14} />
          </button>
          <span className="w-10 text-center text-xs tabular-nums text-muted">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => clampZoom(z + 0.25))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-white/5 hover:text-fg"
            aria-label="Zoom in"
          >
            <Plus size={14} />
          </button>
          {zoom !== 1 && (
            <button
              onClick={() => setZoom(1)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-white/5 hover:text-fg"
              aria-label="Reset zoom"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>

        {/* View switch */}
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-panel p-1">
          {(["month", "week", "day"] as CalView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                view === v ? "btn-gold" : "text-muted hover:bg-white/5 hover:text-fg"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="panel min-h-0 flex-1 overflow-hidden">
        {view === "month" ? (
          <MonthView cursor={cursor} now={now} events={events} zoom={zoom} />
        ) : (
          <TimeGridView
            days={view === "week" ? weekDays(cursor) : [cursor]}
            now={now}
            events={events}
            rowHeight={rowHeight}
            scrollRef={scrollRef}
          />
        )}
      </div>

      <p className="text-center text-[11px] text-subtle">
        Tip: ⌘/Ctrl + scroll to zoom · sample schedule — Google Calendar wiring next.
      </p>
    </div>
  );
}

function weekDays(cursor: Date): Date[] {
  const ws = startOfWeek(cursor);
  return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
}

/* ───────────────────────────── Month view ───────────────────────────── */

function MonthView({
  cursor,
  now,
  events,
  zoom,
}: {
  cursor: Date;
  now: Date;
  events: CalEvent[];
  zoom: number;
}) {
  const first = startOfWeek(startOfMonth(cursor));
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  const maxChips = zoom < 0.8 ? 1 : zoom < 1.3 ? 3 : 6;
  const fontPx = Math.round(11 * Math.min(1.4, Math.max(0.85, zoom)));

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_NAMES.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-subtle">
            {d}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {days.map((day) => {
          const inMonth = isSameMonth(day, cursor);
          const today = isSameDay(day, now);
          const dayEvents = events
            .filter((e) => isSameDay(e.start, day))
            .sort((a, b) => a.start.getTime() - b.start.getTime());
          return (
            <div
              key={day.toISOString()}
              className={`min-w-0 overflow-hidden border-b border-r border-border p-1.5 ${
                inMonth ? "" : "opacity-40"
              }`}
            >
              <div className="mb-1 flex justify-end">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    today ? "btn-gold font-semibold" : "text-muted"
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-0.5" style={{ fontSize: fontPx }}>
                {dayEvents.slice(0, maxChips).map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-1 truncate rounded px-1 py-0.5"
                    style={{ background: `color-mix(in srgb, ${e.color} 16%, transparent)` }}
                    title={`${e.title} · ${fmtTime(e.start)}`}
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: e.color }}
                    />
                    <span className="truncate text-fg">{e.title}</span>
                  </div>
                ))}
                {dayEvents.length > maxChips && (
                  <span className="px-1 text-subtle">+{dayEvents.length - maxChips} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────── Week / Day view ─────────────────────────── */

function TimeGridView({
  days,
  now,
  events,
  rowHeight,
  scrollRef,
}: {
  days: Date[];
  now: Date;
  events: CalEvent[];
  rowHeight: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const gutter = 56;
  const gridHeight = rowHeight * 24;

  return (
    <div className="flex h-full flex-col">
      {/* Sticky day headers */}
      <div className="flex border-b border-border" style={{ paddingLeft: gutter }}>
        {days.map((day) => {
          const today = isSameDay(day, now);
          return (
            <div key={day.toISOString()} className="flex-1 px-2 py-2 text-center">
              <div className="text-[11px] uppercase tracking-wide text-subtle">
                {DAY_NAMES[day.getDay()]}
              </div>
              <div
                className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                  today ? "btn-gold font-semibold" : "text-fg"
                }`}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex" style={{ height: gridHeight }}>
          {/* Hour gutter */}
          <div className="relative shrink-0" style={{ width: gutter }}>
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-subtle"
                style={{ top: h * rowHeight }}
              >
                {h === 0 ? "" : fmtHour(h)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const today = isSameDay(day, now);
            const dayEvents = events.filter((e) => isSameDay(e.start, day));
            return (
              <div key={day.toISOString()} className="relative flex-1 border-l border-border">
                {/* hour lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-border/40"
                    style={{ top: h * rowHeight }}
                  />
                ))}

                {/* events */}
                {dayEvents.map((e) => {
                  const top = hoursInto(e.start) * rowHeight;
                  const height = Math.max(
                    18,
                    (hoursInto(e.end) - hoursInto(e.start)) * rowHeight - 2,
                  );
                  return (
                    <div
                      key={e.id}
                      className="absolute inset-x-1 overflow-hidden rounded-md px-1.5 py-0.5"
                      style={{
                        top,
                        height,
                        background: `color-mix(in srgb, ${e.color} 22%, var(--panel))`,
                        borderLeft: `3px solid ${e.color}`,
                      }}
                      title={`${e.title} · ${fmtTime(e.start)}–${fmtTime(e.end)}`}
                    >
                      <p className="truncate text-xs font-medium text-fg">{e.title}</p>
                      {height > 30 && (
                        <p className="truncate text-[10px] text-muted">
                          {fmtTime(e.start)}
                          {e.location ? ` · ${e.location}` : ""}
                        </p>
                      )}
                    </div>
                  );
                })}

                {/* now indicator */}
                {today && (
                  <div
                    className="absolute inset-x-0 z-10 flex items-center"
                    style={{ top: hoursInto(now) * rowHeight }}
                  >
                    <span className="-ml-1 h-2 w-2 rounded-full bg-gold shadow-[0_0_8px_var(--gold-glow)]" />
                    <span className="h-px flex-1 bg-gold" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

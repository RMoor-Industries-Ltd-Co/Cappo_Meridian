/** Lightweight date helpers + sample events for the Calendar module. */

export type CalView = "month" | "week" | "day";

export interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color: string; // CSS color
  location?: string;
  allDay?: boolean;
  url?: string; // deep link (e.g. back to the ClickUp task)
}

/** Visible date span for a given view (month shows 6 surrounding weeks). */
export function visibleRange(view: CalView, cursor: Date): { start: Date; end: Date } {
  if (view === "month") {
    const start = startOfWeek(startOfMonth(cursor));
    return { start, end: addDays(start, 42) };
  }
  if (view === "week") {
    const start = startOfWeek(cursor);
    return { start, end: addDays(start, 7) };
  }
  const start = startOfDay(cursor);
  return { start, end: addDays(start, 1) };
}

/** Sample events for the visible range (fallback before ClickUp is connected). */
export function sampleForView(view: CalView, cursor: Date): CalEvent[] {
  if (view === "month") {
    const first = startOfWeek(startOfMonth(cursor));
    return Array.from({ length: 6 }).flatMap((_, w) =>
      sampleEvents(addDays(first, w * 7)).map((e) => ({ ...e, id: `${e.id}-${w}` })),
    );
  }
  return sampleEvents(cursor);
}

export const HOURS = Array.from({ length: 24 }, (_, h) => h);
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const addMonths = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
export const startOfWeek = (d: Date) => addDays(startOfDay(d), -d.getDay()); // Sunday
export const startOfMonth = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), 1);

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
export const isSameMonth = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

export const fmtHour = (h: number) => {
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${ampm}`;
};
export const fmtTime = (d: Date) => {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? "AM" : "PM";
  h = h % 12 === 0 ? 12 : h % 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
};

/** Fractional hours since midnight (for vertical positioning). */
export const hoursInto = (d: Date) => d.getHours() + d.getMinutes() / 60;

const COLORS = {
  gold: "var(--gold)",
  violet: "#7c6cf0",
  green: "#6fcf97",
  rose: "#e88aa0",
  blue: "#6cc0f0",
};

/** Deterministic sample schedule anchored to the current week. */
export function sampleEvents(ref: Date): CalEvent[] {
  const wk = startOfWeek(ref);
  const at = (dayOffset: number, h: number, m: number) => {
    const d = addDays(wk, dayOffset);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
  };
  const ev = (
    id: string,
    title: string,
    dayOffset: number,
    sh: number,
    sm: number,
    durMin: number,
    color: string,
    location?: string,
  ): CalEvent => ({
    id,
    title,
    start: at(dayOffset, sh, sm),
    end: new Date(at(dayOffset, sh, sm).getTime() + durMin * 60000),
    color,
    location,
  });

  return [
    ev("1", "Leadership standup", 1, 9, 0, 30, COLORS.gold, "Google Meet"),
    ev("2", "Marketing sync", 1, 11, 0, 45, COLORS.violet),
    ev("3", "Q3 planning workshop", 2, 13, 0, 120, COLORS.gold, "Boardroom"),
    ev("4", "Sales pipeline review", 3, 10, 0, 60, COLORS.green),
    ev("5", "Research deep-dive", 3, 15, 0, 90, COLORS.blue),
    ev("6", "Inventory audit", 4, 9, 30, 75, COLORS.rose),
    ev("7", "Partner call — affiliates", 4, 14, 0, 45, COLORS.violet, "Zoom"),
    ev("8", "Budget close", 5, 11, 0, 60, COLORS.green),
    ev("9", "Legal review", 5, 16, 0, 30, COLORS.gold),
    ev("10", "1:1", 2, 9, 0, 30, COLORS.blue),
    ev("11", "Ops retro", 0, 17, 0, 45, COLORS.rose),
  ];
}

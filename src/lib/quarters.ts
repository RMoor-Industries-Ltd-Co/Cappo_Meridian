/** Fiscal-quarter helpers. AMG runs calendar quarters (Q1 = Jan–Mar). */

export type QuarterId = "company" | "Q1" | "Q2" | "Q3" | "Q4";

export interface QuarterMeta {
  id: QuarterId;
  label: string;
  months?: [number, number, number]; // 0-indexed
}

export const QUARTERS: QuarterMeta[] = [
  { id: "company", label: "Company" },
  { id: "Q1", label: "Q1", months: [0, 1, 2] },
  { id: "Q2", label: "Q2", months: [3, 4, 5] },
  { id: "Q3", label: "Q3", months: [6, 7, 8] },
  { id: "Q4", label: "Q4", months: [9, 10, 11] },
];

export function currentQuarter(date = new Date()): Exclude<QuarterId, "company"> {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `Q${q}` as Exclude<QuarterId, "company">;
}

export function quarterDateRange(
  q: Exclude<QuarterId, "company">,
  year = new Date().getFullYear(),
): { start: Date; end: Date } {
  const meta = QUARTERS.find((m) => m.id === q)!;
  const [first] = meta.months!;
  const start = new Date(year, first, 1);
  const end = new Date(year, first + 3, 0, 23, 59, 59); // last day of quarter
  return { start, end };
}

/** Days remaining in the given quarter (for "Q3 starts in N days" hints). */
export function daysUntilNextQuarter(date = new Date()): number {
  const q = Math.floor(date.getMonth() / 3); // 0..3
  const nextStart = new Date(date.getFullYear(), (q + 1) * 3, 1);
  return Math.ceil((nextStart.getTime() - date.getTime()) / 86_400_000);
}

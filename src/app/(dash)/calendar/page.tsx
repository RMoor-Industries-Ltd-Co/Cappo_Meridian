"use client";

import dynamic from "next/dynamic";

// Client-only: the calendar reads window size and the current time up front,
// so skipping SSR avoids hydration mismatches and a flash of fallback view.
const CalendarClient = dynamic(
  () => import("@/components/calendar/CalendarClient"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100dvh-7rem)] items-center justify-center text-subtle">
        Loading calendar…
      </div>
    ),
  },
);

export default function CalendarPage() {
  return <CalendarClient />;
}

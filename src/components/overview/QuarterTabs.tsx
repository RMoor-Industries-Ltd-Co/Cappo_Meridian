"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { QUARTERS, type QuarterId } from "@/lib/quarters";

export function QuarterTabs({ active }: { active: QuarterId }) {
  const router = useRouter();
  const params = useSearchParams();

  function select(id: QuarterId) {
    const next = new URLSearchParams(params.toString());
    if (id === "company") next.delete("q");
    else next.set("q", id);
    router.push(`/?${next.toString()}`);
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-panel p-1">
      {QUARTERS.map((q) => {
        const isActive = q.id === active;
        return (
          <button
            key={q.id}
            onClick={() => select(q.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "btn-gold"
                : "text-muted hover:bg-white/5 hover:text-fg"
            }`}
          >
            {q.label}
          </button>
        );
      })}
    </div>
  );
}

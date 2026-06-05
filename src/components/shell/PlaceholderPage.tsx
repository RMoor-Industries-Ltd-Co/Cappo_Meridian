import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";

/** Consistent scaffold for sections still being built out. */
export function PlaceholderPage({
  icon: Icon,
  title,
  blurb,
  planned,
}: {
  icon: LucideIcon;
  title: string;
  blurb: string;
  planned: string[];
}) {
  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-strong bg-panel text-gold">
          <Icon size={22} strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-fg">{title}</h1>
          <p className="text-sm text-subtle">{blurb}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="flex h-32 flex-col justify-between p-5">
            <div className="h-3 w-24 rounded bg-white/5" />
            <div className="h-8 w-32 rounded bg-white/5" />
            <div className="h-3 w-20 rounded bg-white/5" />
          </Card>
        ))}
      </div>

      <Card gold className="p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Planned for this module
        </h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {planned.map((p) => (
            <li key={p} className="flex items-center gap-2 text-sm text-fg">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              {p}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

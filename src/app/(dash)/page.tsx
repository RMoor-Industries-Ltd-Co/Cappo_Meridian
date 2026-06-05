import Link from "next/link";
import { ExternalLink, CircleDot } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Kpi } from "@/components/ui/Kpi";
import { Sparkline } from "@/components/ui/Sparkline";
import { QuarterTabs } from "@/components/overview/QuarterTabs";
import { getConnector } from "@/lib/connectors";
import type { UnifiedItem } from "@/lib/types";
import {
  currentQuarter,
  daysUntilNextQuarter,
  quarterDateRange,
  QUARTERS,
  type QuarterId,
} from "@/lib/quarters";

export const dynamic = "force-dynamic";

async function loadClickUpTasks(): Promise<{ tasks: UnifiedItem[]; configured: boolean }> {
  const clickup = getConnector("clickup");
  if (!clickup?.isConfigured()) return { tasks: [], configured: false };
  try {
    const tasks = (await clickup.listRecent?.(50)) ?? [];
    return { tasks, configured: true };
  } catch {
    return { tasks: [], configured: true };
  }
}

function withinQuarter(item: UnifiedItem, q: QuarterId): boolean {
  if (q === "company" || !item.updatedAt) return true;
  const { start, end } = quarterDateRange(q);
  const t = new Date(item.updatedAt).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

const today = new Intl.DateTimeFormat("en-US", {
  weekday: undefined,
  day: "2-digit",
  month: "long",
  year: "numeric",
}).format(new Date());

export default async function Overview({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const active: QuarterId =
    q && QUARTERS.some((x) => x.id === q) ? (q as QuarterId) : currentQuarter();
  const activeLabel = QUARTERS.find((x) => x.id === active)?.label ?? "Company";
  const daysToNext = daysUntilNextQuarter();

  const { tasks, configured } = await loadClickUpTasks();
  const scoped = tasks.filter((t) => withinQuarter(t, active));
  const open = scoped.filter(
    (t) => t.status && !/done|complete|closed/i.test(t.status),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <section className="flex flex-col items-center pt-6 text-center">
        <h1 className="text-3xl font-semibold italic text-fg">Welcome buddy!</h1>
        <p className="mt-1 text-sm text-subtle">
          Today · {today} ·{" "}
          <span className="text-gold">
            {activeLabel === "Company" ? "Company view" : `${activeLabel} ${new Date().getFullYear()}`}
          </span>
        </p>
        <div className="mt-4">
          <QuarterTabs active={active} />
        </div>
        {daysToNext <= 45 && (
          <p className="mt-2 text-xs text-subtle">
            {currentQuarter()} ends in <span className="text-gold">{daysToNext} days</span> —{" "}
            {`Q${Math.min(4, Math.floor(new Date().getMonth() / 3) + 2)}`} opens soon.
          </p>
        )}
      </section>

      {/* KPI row */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Projects" value="2,040" delta={12} period={activeLabel} />
        <Kpi
          label="Open Tasks"
          value={configured ? String(open.length) : "158"}
          delta={configured ? undefined : 12}
          period={configured ? "from ClickUp" : activeLabel}
        />
        <Kpi label="Clients" value="158" delta={12} period={activeLabel} />
        <Kpi label="Revenue" value="$72K" delta={-12} period={activeLabel} />
      </section>

      {/* Main grid */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Work progress */}
        <Card className="col-span-1 flex flex-col p-5 xl:col-span-2">
          <SectionTitle
            title="Work Progress Overview"
            action={
              <div className="flex items-center gap-3 text-xs text-subtle">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-gold" /> Success
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#7c6cf0]" /> Failed
                </span>
              </div>
            }
          />
          <div className="flex-1">
            <Sparkline
              data={[3, 4, 3.5, 5, 4.2, 6, 5.4, 7, 6.5, 8, 7.2, 8.6]}
              width={760}
              height={180}
              color="var(--gold)"
            />
          </div>
          <div className="mt-2 grid grid-cols-12 text-[10px] text-subtle">
            {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(
              (m) => (
                <span key={m} className="text-center">
                  {m}
                </span>
              ),
            )}
          </div>
        </Card>

        {/* Quarter progress gauge */}
        <Card gold className="flex flex-col items-center justify-center gap-3 p-5">
          <SectionTitle title="Quarter Progress" />
          <QuarterGauge active={active} />
          <p className="text-center text-xs text-subtle">
            {active === "company"
              ? "Company-wide completion across the AMG space."
              : `Task completion for ${activeLabel}.`}
          </p>
        </Card>
      </section>

      {/* ClickUp tasks */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="col-span-1 p-5 lg:col-span-2">
          <SectionTitle
            title="AMG ClickUp · Tasks"
            action={
              <span className="text-xs text-subtle">
                {configured ? `${scoped.length} in ${activeLabel}` : "Not connected"}
              </span>
            }
          />
          {!configured ? (
            <EmptyClickUp />
          ) : scoped.length === 0 ? (
            <p className="py-6 text-center text-sm text-subtle">
              No tasks in {activeLabel}. Try the Company view.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {scoped.slice(0, 8).map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <CircleDot size={14} className="shrink-0 text-gold" />
                  <a
                    href={t.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 truncate text-sm text-fg hover:text-gold"
                  >
                    {t.title}
                  </a>
                  {t.status && (
                    <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] uppercase text-muted">
                      {t.status}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Status tracker (sample) */}
        <Card className="p-5">
          <SectionTitle title="Status Tracker" />
          <ul className="flex flex-col gap-3">
            {[
              { name: "James Brown", team: "Synergy", eta: "2 Hr" },
              { name: "Olivia Stone", team: "Apex", eta: "1 Hr" },
              { name: "Liam Carter", team: "Meridian", eta: "Tomorrow" },
            ].map((p) => (
              <li key={p.name} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gold-bright to-gold-deep" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">{p.name}</p>
                  <p className="text-xs text-subtle">{p.team}</p>
                </div>
                <span className="text-xs text-muted">{p.eta}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}

function QuarterGauge({ active }: { active: QuarterId }) {
  // Rough completion proxy for the visual; real value wired to ClickUp later.
  const pct = active === "company" ? 64 : 42;
  const r = 52;
  const circ = Math.PI * r; // half circle
  const dash = (pct / 100) * circ;
  return (
    <div className="relative h-28 w-44">
      <svg viewBox="0 0 140 80" className="h-full w-full">
        <path
          d="M14 74 A56 56 0 0 1 126 74"
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M14 74 A56 56 0 0 1 126 74"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ filter: "drop-shadow(0 0 6px var(--gold-glow))" }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-1 text-center">
        <span className="text-3xl font-semibold text-fg">{pct}</span>
        <span className="text-sm text-subtle">%</span>
      </div>
    </div>
  );
}

function EmptyClickUp() {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <p className="text-sm text-muted">Connect ClickUp to surface the AMG space here.</p>
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong px-3 py-1.5 text-sm text-gold hover:bg-gold/10"
      >
        Configure integration <ExternalLink size={14} />
      </Link>
    </div>
  );
}

import Link from "next/link";
import { CircleDot, ExternalLink, Inbox, Video } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Kpi } from "@/components/ui/Kpi";
import { QuarterTabs } from "@/components/overview/QuarterTabs";
import { getConnector } from "@/lib/connectors";
import { type BoardStatus, type BoardTask, clickupAmgBoard } from "@/lib/connectors/clickup";
import {
  getAmgStructure,
  getCaptureInbox,
  getMeetingNotes,
  isWikiConfigured,
  type MeetingNote,
  type OrgUnit,
  type WikiItem,
} from "@/lib/connectors/notionWiki";
import {
  currentQuarter,
  daysUntilNextQuarter,
  quarterDateRange,
  QUARTERS,
  type QuarterId,
} from "@/lib/quarters";

export const dynamic = "force-dynamic";

const isDone = (name: string, type: string) =>
  type === "done" || type === "closed" || /done|complete|closed/i.test(name);
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

async function loadBoard(): Promise<{ tasks: BoardTask[]; statuses: BoardStatus[]; configured: boolean }> {
  const clickup = getConnector("clickup");
  if (!clickup?.isConfigured()) return { tasks: [], statuses: [], configured: false };
  try {
    const b = await clickupAmgBoard();
    return { ...b, configured: true };
  } catch {
    return { tasks: [], statuses: [], configured: true };
  }
}

async function loadWiki(): Promise<{
  units: OrgUnit[];
  domains: string[];
  meetings: MeetingNote[];
  captures: WikiItem[];
  configured: boolean;
}> {
  if (!isWikiConfigured()) return { units: [], domains: [], meetings: [], captures: [], configured: false };
  try {
    const [structure, meetings, captures] = await Promise.all([
      getAmgStructure(),
      getMeetingNotes(5),
      getCaptureInbox(5),
    ]);
    return { ...structure, meetings, captures, configured: true };
  } catch {
    return { units: [], domains: [], meetings: [], captures: [], configured: true };
  }
}

const today = new Intl.DateTimeFormat("en-US", {
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

  const [board, wiki] = await Promise.all([loadBoard(), loadWiki()]);

  // Work metrics (company-wide, live from ClickUp).
  const tasks = board.tasks;
  const activeTasks = tasks.filter((t) => !isDone(t.status, t.statusType));
  const doneCount = tasks.length - activeTasks.length;
  const completion = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  // Status breakdown (swim-lane summary).
  const lanes = board.statuses
    .map((s) => ({ ...s, count: tasks.filter((t) => t.status === s.name).length }))
    .filter((s) => s.count > 0);
  const maxLane = Math.max(1, ...lanes.map((l) => l.count));

  // Quarter-scoped open-task list (by due date; Company = all).
  const range = active === "company" ? null : quarterDateRange(active);
  const quarterTasks = activeTasks
    .filter((t) => {
      if (!range) return true;
      if (!t.due) return false;
      const due = new Date(t.due).getTime();
      return due >= range.start.getTime() && due <= range.end.getTime();
    })
    .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"))
    .slice(0, 8);

  const brands = wiki.units.filter((u) => u.type === "Brand" || u.type === "Product Line").length;

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
            {currentQuarter()} ends in <span className="text-gold">{daysToNext} days</span>.
          </p>
        )}
      </section>

      {/* Live KPI row */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Active Tasks" value={board.configured ? String(activeTasks.length) : "—"} period="AMG space" />
        <Kpi label="Completed" value={board.configured ? String(doneCount) : "—"} period="AMG space" />
        <Kpi label="Business Units" value={wiki.configured ? String(wiki.units.length) : "—"} period={`${brands} brands`} />
        <Kpi label="Capture Inbox" value={wiki.configured ? String(wiki.captures.length) : "—"} period="ideas" />
      </section>

      {/* Status breakdown + quarter gauge */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="col-span-1 flex flex-col p-5 xl:col-span-2">
          <SectionTitle
            title="Work Breakdown · AMG ClickUp"
            action={<span className="text-xs text-subtle">{tasks.length} tasks</span>}
          />
          {!board.configured ? (
            <EmptyClickUp />
          ) : lanes.length === 0 ? (
            <p className="py-8 text-center text-sm text-subtle">No tasks in the AMG space.</p>
          ) : (
            <ul className="flex flex-col gap-3 pt-1">
              {lanes.map((l) => (
                <li key={l.name} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-xs uppercase tracking-wide text-muted">{l.name}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(l.count / maxLane) * 100}%`, background: l.color }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm text-fg">{l.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card gold className="flex flex-col items-center justify-center gap-3 p-5">
          <SectionTitle title="Completion" />
          <Gauge pct={completion} />
          <p className="text-center text-xs text-subtle">
            {board.configured
              ? `${doneCount} of ${tasks.length} AMG tasks complete.`
              : "Connect ClickUp to track completion."}
          </p>
        </Card>
      </section>

      {/* Tasks + recent activity */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="col-span-1 p-5 lg:col-span-2">
          <SectionTitle
            title="Open Tasks"
            action={
              <span className="text-xs text-subtle">
                {board.configured ? `${quarterTasks.length} in ${activeLabel}` : "Not connected"}
              </span>
            }
          />
          {!board.configured ? (
            <EmptyClickUp />
          ) : quarterTasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-subtle">
              No open tasks due in {activeLabel}. Try the Company view.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {quarterTasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <CircleDot size={14} className="shrink-0" style={{ color: t.statusColor }} />
                  <a href={t.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm text-fg hover:text-gold">
                    {t.name}
                  </a>
                  <span className="hidden rounded-md bg-white/5 px-2 py-0.5 text-[10px] uppercase text-muted sm:block">
                    {t.status}
                  </span>
                  {t.due && <span className="shrink-0 text-xs text-subtle">{fmtDate(t.due)}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Recent across AMG */}
        <Card className="p-5">
          <SectionTitle title="Recent Activity" />
          {!wiki.configured ? (
            <p className="py-6 text-sm text-subtle">Connect Notion to surface AMG activity.</p>
          ) : wiki.meetings.length === 0 && wiki.captures.length === 0 ? (
            <p className="py-6 text-sm text-subtle">No recent wiki activity yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {wiki.meetings.map((m) => (
                <li key={m.id} className="flex items-start gap-2.5">
                  <Video size={14} className="mt-0.5 shrink-0 text-gold" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-fg">{m.title}</p>
                    <p className="text-xs text-subtle">{[m.source, fmtDate(m.date)].filter(Boolean).join(" · ") || "Meeting"}</p>
                  </div>
                </li>
              ))}
              {wiki.captures.map((c) => (
                <li key={c.id} className="flex items-start gap-2.5">
                  <Inbox size={14} className="mt-0.5 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-fg">{c.title}</p>
                    <p className="text-xs text-subtle">{c.meta || "Captured"}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function Gauge({ pct }: { pct: number }) {
  const r = 56;
  const circ = Math.PI * r; // half circle
  const dash = (pct / 100) * circ;
  return (
    <div className="relative h-28 w-44">
      <svg viewBox="0 0 140 80" className="h-full w-full">
        <path d="M14 74 A56 56 0 0 1 126 74" fill="none" stroke="var(--border-strong)" strokeWidth="10" strokeLinecap="round" />
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

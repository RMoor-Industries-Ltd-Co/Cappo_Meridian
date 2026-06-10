"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CircleDot,
  ExternalLink,
  Gavel,
  Inbox,
  Layers,
  ListChecks,
  RefreshCw,
} from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Kpi } from "@/components/ui/Kpi";
import { WikiQuickAdd } from "@/components/wiki/WikiQuickAdd";

interface BoardTask {
  id: string;
  name: string;
  url: string;
  status: string;
  statusColor: string;
  statusType: string;
  due: string | null;
  assignees: string[];
}
interface BoardStatus { name: string; color: string; type: string; order: number }
interface OrgUnit { id: string; name: string; type: string; status: string; parentId: string | null }
interface MeetingNote { id: string; title: string; date: string | null; source: string; link: string | null; summary: string; url: string }
interface WikiItem { id: string; title: string; meta: string; url: string }

interface Payload {
  clickupConfigured: boolean;
  notionConfigured: boolean;
  board: { tasks: BoardTask[]; statuses: BoardStatus[] };
  structure: { units: OrgUnit[]; domains: string[] };
  meetings: MeetingNote[];
  captures: WikiItem[];
  decisions: WikiItem[];
  actions: WikiItem[];
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

const SOURCE_COLOR: Record<string, string> = {
  Fathom: "#7c6cf0",
  Gemini: "#4d9eff",
  ClickUp: "#ff7fab",
  Notion: "#c9c9c9",
};

export function OperationsPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [nonce, setNonce] = useState(0);
  const [movingId, setMovingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/operations")
      .then((r) => r.json())
      .then((d: Payload) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const move = useCallback(async (taskId: string, status: string) => {
    setMovingId(taskId);
    try {
      const res = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(e.error || "Could not move task");
        return;
      }
      setNonce((n) => n + 1);
    } finally {
      setMovingId(null);
    }
  }, []);

  const loading = data === null;
  const board = data?.board ?? { tasks: [], statuses: [] };
  const units = data?.structure.units ?? [];
  const domains = data?.structure.domains ?? [];
  const meetings = data?.meetings ?? [];

  const isDoneStatus = (name: string, type: string) =>
    type === "done" || type === "closed" || /done|complete|closed/i.test(name);
  const lanes = board.statuses
    .map((s) => ({ status: s, items: board.tasks.filter((t) => t.status === s.name) }))
    .filter((l) => !isDoneStatus(l.status.name, l.status.type));
  const activeCount = lanes.reduce((n, l) => n + l.items.length, 0);
  const doneCount = board.tasks.length - activeCount;
  const statusNames = board.statuses.map((s) => s.name);

  return (
    <div className="flex flex-col gap-6 pt-2">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-strong bg-panel text-gold">
          <Building2 size={22} strokeWidth={1.75} />
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-fg">Operations</h1>
          <p className="text-sm text-subtle">
            Live AMG structure, current work swim lanes, and meeting notes — one place.
          </p>
        </div>
        <button
          onClick={() => setNonce((n) => n + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-panel text-subtle hover:text-fg"
          title="Refresh"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <WikiQuickAdd onAdded={() => setNonce((n) => n + 1)} />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Business Units" value={loading ? "—" : String(units.length)} period="AMG tree" />
        <Kpi label="Active Tasks" value={loading ? "—" : String(activeCount)} period="ClickUp" />
        <Kpi label="Capture Inbox" value={loading ? "—" : String(data?.captures.length ?? 0)} period="ideas" />
        <Kpi label="Meeting Notes" value={loading ? "—" : String(meetings.length)} period="recent" />
      </div>

      {(!data?.clickupConfigured || !data?.notionConfigured) && !loading && (
        <Card className="p-4 text-sm text-subtle">
          {!data?.notionConfigured && <>Notion isn&apos;t connected. </>}
          {!data?.clickupConfigured && <>ClickUp isn&apos;t connected. </>}
          <Link href="/settings" className="text-gold hover:underline">Open Settings</Link>
        </Card>
      )}

      {/* Swim lanes + structure */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Swim lanes */}
        <Card className="col-span-1 flex flex-col p-5 xl:col-span-2">
          <SectionTitle
            title="Swim Lanes · AMG ClickUp"
            action={
              <span className="text-xs text-subtle">
                {activeCount} active{doneCount > 0 ? ` · ${doneCount} done (hidden)` : ""}
              </span>
            }
          />
          {loading ? (
            <p className="py-8 text-center text-sm text-subtle">Loading…</p>
          ) : activeCount === 0 ? (
            <p className="py-8 text-center text-sm text-subtle">
              No active tasks in the AMG space.{doneCount > 0 ? ` (${doneCount} completed)` : ""}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {lanes.map(({ status, items }) => (
                <div key={status.name}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: status.color }} />
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{status.name}</h3>
                    <span className="text-xs text-subtle">{items.length}</span>
                  </div>
                  <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                    {items.map((t) => (
                      <li key={t.id} className="flex items-center gap-2.5 px-3 py-2">
                        <CircleDot size={14} className="shrink-0" style={{ color: status.color }} />
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 flex-1 truncate text-sm text-fg hover:text-gold"
                        >
                          {t.name}
                        </a>
                        {t.due && <span className="shrink-0 text-xs text-subtle">{fmtDate(t.due)}</span>}
                        <select
                          value={t.status}
                          disabled={movingId === t.id}
                          onChange={(e) => move(t.id, e.target.value)}
                          title="Move to status"
                          className="shrink-0 rounded-md border border-border bg-panel px-1.5 py-1 text-xs text-muted focus:outline-none disabled:opacity-50"
                        >
                          {statusNames.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* AMG structure */}
        <Card className="p-5">
          <SectionTitle title="AMG Structure" />
          {loading ? (
            <p className="py-6 text-center text-sm text-subtle">Loading…</p>
          ) : units.length === 0 ? (
            <p className="py-6 text-sm text-subtle">No structure yet.</p>
          ) : (
            <Tree units={units} />
          )}
          <div className="mt-4 border-t border-border pt-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <Layers size={13} /> Domains
            </div>
            <div className="flex flex-wrap gap-1.5">
              {domains.map((d) => (
                <span key={d} className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-muted">{d}</span>
              ))}
            </div>
          </div>
        </Card>
      </section>

      {/* Meeting notes + capture */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="col-span-1 p-5 lg:col-span-2">
          <SectionTitle
            title="Meeting Notes"
            action={<span className="text-xs text-subtle">Fathom · Gemini · ClickUp · Notion</span>}
          />
          {loading ? (
            <p className="py-6 text-center text-sm text-subtle">Loading…</p>
          ) : meetings.length === 0 ? (
            <p className="py-6 text-sm text-subtle">
              No meeting notes yet. Add a row to the Meeting Notes database (Source + link + summary) and it shows here.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {meetings.map((m) => (
                <li key={m.id} className="flex flex-col gap-1 py-3">
                  <div className="flex items-center gap-2">
                    {m.source && (
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase"
                        style={{ background: `${SOURCE_COLOR[m.source] ?? "#888"}22`, color: SOURCE_COLOR[m.source] ?? "#aaa" }}
                      >
                        {m.source}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{m.title}</span>
                    {m.date && <span className="shrink-0 text-xs text-subtle">{fmtDate(m.date)}</span>}
                    {m.link && (
                      <a href={m.link} target="_blank" rel="noreferrer" className="shrink-0 text-subtle hover:text-gold" title="Open source">
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                  {m.summary && <p className="line-clamp-2 text-xs text-subtle">{m.summary}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <WikiList title="Capture Inbox" icon={<Inbox size={13} />} items={data?.captures ?? []} loading={loading} empty="Nothing captured yet." />
      </section>

      {/* Decisions + actions */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WikiList title="Decisions Log" icon={<Gavel size={13} />} items={data?.decisions ?? []} loading={loading} empty="No decisions logged yet." />
        <WikiList title="Action Register" icon={<ListChecks size={13} />} items={data?.actions ?? []} loading={loading} empty="No partner actions yet." />
      </section>
    </div>
  );
}

function Tree({ units }: { units: OrgUnit[] }) {
  const childrenOf = (pid: string | null) =>
    units.filter((u) => (pid === null ? !u.parentId || !units.some((x) => x.id === u.parentId) : u.parentId === pid));

  const render = (pid: string | null, depth: number): ReactNode[] =>
    childrenOf(pid).flatMap((u) => [
      <li key={u.id} className="flex items-center gap-2 py-1" style={{ paddingLeft: depth * 14 }}>
        <span className="text-sm text-fg">{u.name}</span>
        {u.type && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase text-subtle">{u.type}</span>}
        {u.status && u.status !== "Active" && (
          <span className="text-[10px] text-subtle">· {u.status}</span>
        )}
      </li>,
      ...render(u.id, depth + 1),
    ]);

  return <ul className="flex flex-col">{render(null, 0)}</ul>;
}

function WikiList({
  title,
  icon,
  items,
  loading,
  empty,
}: {
  title: string;
  icon: ReactNode;
  items: WikiItem[];
  loading: boolean;
  empty: string;
}) {
  return (
    <Card className="p-5">
      <SectionTitle title={title} action={<span className="text-subtle">{icon}</span>} />
      {loading ? (
        <p className="py-6 text-center text-sm text-subtle">Loading…</p>
      ) : items.length === 0 ? (
        <p className="py-4 text-sm text-subtle">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 py-2">
              <a
                href={it.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-sm text-fg hover:text-gold"
              >
                {it.title}
              </a>
              {it.meta && <span className="shrink-0 text-xs text-subtle">{it.meta}</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

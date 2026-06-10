"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CircleDot, Plus, RefreshCw, X } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Kpi } from "@/components/ui/Kpi";

interface Task {
  id: string;
  name: string;
  url: string;
  status: string;
  statusColor: string;
  statusType: string;
  due: string | null;
  assignees: string[];
}
interface WikiItem { id: string; title: string; meta: string; url: string }
interface Bundle {
  catalog: WikiItem[];
  documents: WikiItem[];
  decisions: WikiItem[];
  actions: WikiItem[];
  captures: WikiItem[];
  glossary: WikiItem[];
}
interface Payload {
  domain: string;
  tag: string;
  clickupConfigured: boolean;
  notionConfigured: boolean;
  tasks: Task[];
  bundle: Bundle;
}

const isDone = (name: string, type: string) =>
  type === "done" || type === "closed" || /done|complete|closed/i.test(name);
const fmtDue = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

/**
 * Live function-module view: AMG ClickUp tasks tagged for the module (swim
 * lanes with status control + quick-add) plus Notion wiki records tagged with
 * the matching Domain.
 */
export function DomainModule({ domain, blurb, icon }: { domain: string; blurb: string; icon: ReactNode }) {
  const [data, setData] = useState<Payload | null>(null);
  const [nonce, setNonce] = useState(0);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/domain?name=${encodeURIComponent(domain)}`)
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
  }, [domain, nonce]);

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

  async function addTask() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), tag: data?.tag || domain.toLowerCase() }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(e.error || "Could not create task");
        return;
      }
      setName("");
      setAdding(false);
      setNonce((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  const loading = data === null;
  const tasks = data?.tasks ?? [];
  const active = tasks.filter((t) => !isDone(t.status, t.statusType));
  const doneCount = tasks.length - active.length;
  const statusNames = [...new Set(tasks.map((t) => t.status))];

  const laneMap = new Map<string, { color: string; items: Task[] }>();
  for (const t of active) {
    const g = laneMap.get(t.status) ?? { color: t.statusColor, items: [] };
    g.items.push(t);
    laneMap.set(t.status, g);
  }
  const lanes = [...laneMap.entries()];

  const bundle = data?.bundle;
  const wikiSections: { title: string; items: WikiItem[] }[] = bundle
    ? [
        { title: "Catalog", items: bundle.catalog },
        { title: "Documents", items: bundle.documents },
        { title: "Decisions", items: bundle.decisions },
        { title: "Actions", items: bundle.actions },
        { title: "Captured Ideas", items: bundle.captures },
        { title: "Glossary", items: bundle.glossary },
      ].filter((s) => s.items.length > 0)
    : [];
  const wikiCount = wikiSections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="flex flex-col gap-6 pt-2">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-strong bg-panel text-gold">
          {icon}
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-fg">{domain}</h1>
          <p className="text-sm text-subtle">{blurb}</p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg btn-gold px-3 py-2 text-sm"
        >
          <Plus size={15} /> New task
        </button>
        <button
          onClick={() => setNonce((n) => n + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-panel text-subtle hover:text-fg"
          title="Refresh"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {adding && (
        <Card gold className="flex flex-wrap items-center gap-2 p-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder={`New #${data?.tag || domain.toLowerCase()} task…`}
            className="min-w-0 flex-1 rounded-lg border border-border bg-panel px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none"
          />
          <button
            onClick={addTask}
            disabled={!name.trim() || busy}
            className="rounded-lg btn-gold px-4 py-2 text-sm disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add to ClickUp"}
          </button>
          <button
            onClick={() => setAdding(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-panel text-subtle hover:text-fg"
            title="Cancel"
          >
            <X size={15} />
          </button>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Active Tasks" value={loading ? "—" : String(active.length)} period={`#${data?.tag ?? domain.toLowerCase()}`} />
        <Kpi label="Done" value={loading ? "—" : String(doneCount)} period="complete" />
        <Kpi label="Wiki Records" value={loading ? "—" : String(wikiCount)} period="Notion" />
      </div>

      {!loading && !data?.clickupConfigured && !data?.notionConfigured && (
        <Card className="p-4 text-sm text-subtle">
          Connect ClickUp and Notion to populate this module.{" "}
          <Link href="/settings" className="text-gold hover:underline">Open Settings</Link>
        </Card>
      )}

      {/* Swim lanes */}
      <Card className="flex flex-col p-5">
        <SectionTitle
          title="Swim Lanes"
          action={
            <span className="text-xs text-subtle">
              {active.length} active{doneCount > 0 ? ` · ${doneCount} done` : ""}
            </span>
          }
        />
        {loading ? (
          <p className="py-6 text-center text-sm text-subtle">Loading…</p>
        ) : active.length === 0 ? (
          <p className="py-6 text-center text-sm text-subtle">
            No active tasks tagged <code className="rounded bg-white/5 px-1.5 py-0.5 text-gold">{data?.tag ?? domain.toLowerCase()}</code> in the AMG space.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {lanes.map(([status, g]) => (
              <div key={status}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} />
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{status}</h3>
                  <span className="text-xs text-subtle">{g.items.length}</span>
                </div>
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                  {g.items.map((t) => (
                    <li key={t.id} className="flex items-center gap-2.5 px-3 py-2">
                      <CircleDot size={14} className="shrink-0" style={{ color: g.color }} />
                      <a href={t.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm text-fg hover:text-gold">
                        {t.name}
                      </a>
                      {t.due && <span className="shrink-0 text-xs text-subtle">{fmtDue(t.due)}</span>}
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

      {/* Notion records for this domain */}
      {wikiSections.length > 0 && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {wikiSections.map((s) => (
            <Card key={s.title} className="p-5">
              <SectionTitle title={s.title} action={<span className="text-xs text-subtle">{s.items.length}</span>} />
              <ul className="flex flex-col divide-y divide-border">
                {s.items.map((it) => (
                  <li key={it.id} className="flex items-center gap-2 py-2">
                    <a href={it.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm text-fg hover:text-gold">
                      {it.title}
                    </a>
                    {it.meta && <span className="shrink-0 text-xs text-subtle">{it.meta}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}

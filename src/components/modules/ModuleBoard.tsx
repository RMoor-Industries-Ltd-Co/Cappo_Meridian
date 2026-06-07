"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { CircleDot, ExternalLink, Plus, RefreshCw, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Kpi } from "@/components/ui/Kpi";

interface ModuleTask {
  id: string;
  name: string;
  url: string;
  status: string;
  statusColor: string;
  statusType: string;
  due: string | null;
  assignees: string[];
}
interface Payload {
  configured: boolean;
  tasks: ModuleTask[];
}

const isDone = (t: ModuleTask) => t.statusType === "done" || t.statusType === "closed";

function fmtDue(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Live function-module board: AMG ClickUp tasks tagged for this module,
 * grouped by status. Populates as the team tags tasks `${tag}` in ClickUp.
 */
export function ModuleBoard({
  tag,
  title,
  blurb,
  icon,
}: {
  tag: string;
  title: string;
  blurb: string;
  icon: ReactNode;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [nonce, setNonce] = useState(0);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  async function addTask() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), tag, due: due || undefined }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(e.error || "Could not create task");
        return;
      }
      setName("");
      setDue("");
      setAdding(false);
      setNonce((n) => n + 1); // refresh board
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/modules?tag=${encodeURIComponent(tag)}`)
      .then((r) => r.json())
      .then((d: Payload) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData({ configured: true, tasks: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [tag, nonce]);

  const loading = data === null;
  const tasks = data?.tasks ?? [];
  const done = tasks.filter(isDone).length;
  const open = tasks.length - done;

  // Group by status name, done groups last.
  const groups = new Map<string, { color: string; type: string; items: ModuleTask[] }>();
  for (const t of tasks) {
    const g = groups.get(t.status) ?? { color: t.statusColor, type: t.statusType, items: [] };
    g.items.push(t);
    groups.set(t.status, g);
  }
  const ordered = [...groups.entries()].sort(
    (a, b) => Number(isDoneType(a[1].type)) - Number(isDoneType(b[1].type)),
  );

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-strong bg-panel text-gold">
          {icon}
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-fg">{title}</h1>
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
            placeholder={`New #${tag} task…`}
            className="min-w-0 flex-1 rounded-lg border border-border bg-panel px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none"
          />
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="rounded-lg border border-border bg-panel px-3 py-2 text-sm text-muted focus:outline-none"
            title="Due date (optional)"
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

      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Tasks" value={loading ? "—" : String(tasks.length)} period="tagged" />
        <Kpi label="Open" value={loading ? "—" : String(open)} period={`#${tag}`} />
        <Kpi label="Done" value={loading ? "—" : String(done)} period="complete" />
      </div>

      {loading ? (
        <Card className="p-8 text-center text-sm text-subtle">Loading…</Card>
      ) : !data?.configured ? (
        <Card className="p-6 text-sm text-subtle">
          ClickUp isn&apos;t connected.{" "}
          <Link href="/settings" className="text-gold hover:underline">Open Settings</Link>
        </Card>
      ) : tasks.length === 0 ? (
        <Card gold className="flex flex-col items-center gap-2 p-10 text-center">
          <p className="text-sm text-muted">Nothing here yet.</p>
          <p className="max-w-md text-sm text-subtle">
            Add the tag <code className="rounded bg-white/5 px-1.5 py-0.5 text-gold">{tag}</code> to
            any task in the AMG ClickUp space and it will appear here, grouped by status.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {ordered.map(([status, g]) => (
            <Card key={status} className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{status}</h2>
                <span className="text-xs text-subtle">{g.items.length}</span>
              </div>
              <ul className="divide-y divide-border">
                {g.items.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                    <CircleDot size={14} className="shrink-0" style={{ color: g.color }} />
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate text-sm text-fg hover:text-gold"
                    >
                      {t.name}
                    </a>
                    {t.assignees.length > 0 && (
                      <span className="hidden text-xs text-subtle sm:block">{t.assignees.join(", ")}</span>
                    )}
                    {t.due && <span className="shrink-0 text-xs text-subtle">{fmtDue(t.due)}</span>}
                    <a href={t.url} target="_blank" rel="noreferrer" className="shrink-0 text-subtle hover:text-fg">
                      <ExternalLink size={13} />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function isDoneType(type: string) {
  return type === "done" || type === "closed";
}

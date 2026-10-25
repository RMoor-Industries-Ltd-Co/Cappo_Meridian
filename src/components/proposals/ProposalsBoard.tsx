"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, ExternalLink, Plus, RefreshCw, X } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";

interface Proposal {
  notionId: string;
  url: string;
  title: string;
  type: string;
  status: string;
  reviewStatus: string;
  decision: string;
  decisionRationale: string;
  submittedBy: string;
  reviewOwner: string;
  sourcePage: string | null;
  driveLink: string | null;
  notes: string;
  created: string | null;
}

interface Tabs {
  overview: Proposal[];
  ideas: Proposal[];
  reviewed: Proposal[];
}

interface TagOption {
  id: string;
  name: string;
}

type TabId = keyof Tabs;

const TAB_META: { id: TabId; label: string; blurb: string }[] = [
  { id: "overview", label: "Overview", blurb: "Proposals actively undergoing formal review." },
  { id: "ideas", label: "Ideas", blurb: "Not yet in formal review — including legacy unclassified entries." },
  { id: "reviewed", label: "Reviewed", blurb: "A documented decision and rationale has been recorded." },
];

const CAPTURE_TYPES = ["Idea", "Product", "Terminology", "Task", "Document"];

const inputCls =
  "w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none";

const decisionTone = (decision: string) => {
  switch (decision) {
    case "Approved Direction":
      return "text-pos";
    case "Rejected":
      return "text-neg";
    case "Revision Requested":
    case "Deferred":
      return "text-gold";
    default:
      return "text-subtle";
  }
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export function ProposalsBoard() {
  const [tab, setTab] = useState<TabId>("ideas");
  const [data, setData] = useState<{ configured: boolean; error?: string; tabs: Tabs } | null>(null);
  const [nonce, setNonce] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showIntake, setShowIntake] = useState(false);

  const [domains, setDomains] = useState<TagOption[]>([]);
  const [brands, setBrands] = useState<TagOption[]>([]);

  const [title, setTitle] = useState("");
  const [type, setType] = useState("Idea");
  const [brandId, setBrandId] = useState("");
  const [domainId, setDomainId] = useState("");
  const [notes, setNotes] = useState("");
  const [submittedBy, setSubmittedBy] = useState("");
  const [sourcePage, setSourcePage] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [reviewOwner, setReviewOwner] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/proposals")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  useEffect(() => {
    if (!showIntake) return;
    fetch("/api/wiki/options")
      .then((r) => r.json())
      .then((d: { brands: TagOption[]; domains: TagOption[] }) => {
        setDomains(d.domains ?? []);
        setBrands(d.brands ?? []);
      })
      .catch(() => {});
  }, [showIntake]);

  function refresh() {
    setLoading(true);
    setNonce((n) => n + 1);
  }

  async function submitProposal() {
    if (!title.trim() || busy) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          type,
          brandId: brandId || undefined,
          domainId: domainId || undefined,
          notes: notes || undefined,
          submittedBy: submittedBy || undefined,
          sourcePage: sourcePage || undefined,
          driveLink: driveLink || undefined,
          reviewOwner: reviewOwner || undefined,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(result.error || "Could not submit proposal");
        return;
      }
      setTitle("");
      setNotes("");
      setSubmittedBy("");
      setSourcePage("");
      setDriveLink("");
      setReviewOwner("");
      setBrandId("");
      setDomainId("");
      setShowIntake(false);
      setTab("ideas");
      refresh();
    } catch {
      setFormError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  const activeTab = TAB_META.find((t) => t.id === tab) ?? TAB_META[0];
  const list = data?.tabs[tab] ?? [];

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-strong bg-panel text-gold">
            <ClipboardList size={22} strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-fg">Proposals</h1>
            <p className="text-sm text-subtle">Idea intake, governance review, and proposal decisions.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowIntake((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg btn-gold px-3 py-2 text-sm"
          >
            <Plus size={15} /> New Proposal
          </button>
          <button
            onClick={refresh}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-panel text-subtle hover:text-fg"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {showIntake && (
        <Card gold className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-fg">New Proposal</h3>
            <button onClick={() => setShowIntake(false)} className="text-subtle hover:text-fg">
              <X size={15} />
            </button>
          </div>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title…"
            className={inputCls}
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
              {CAPTURE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inputCls}>
              <option value="">Brand…</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select value={domainId} onChange={(e) => setDomainId(e.target.value)} className={inputCls}>
              <option value="">Domain…</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={submittedBy}
              onChange={(e) => setSubmittedBy(e.target.value)}
              placeholder="Submitted by…"
              className={inputCls}
            />
            <input
              value={reviewOwner}
              onChange={(e) => setReviewOwner(e.target.value)}
              placeholder="Review owner (optional)…"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={sourcePage}
              onChange={(e) => setSourcePage(e.target.value)}
              placeholder="Source page link (optional)…"
              className={inputCls}
            />
            <input
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              placeholder="Drive link (optional)…"
              className={inputCls}
            />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes / description…"
            rows={3}
            className={inputCls}
          />
          {formError && <p className="text-sm text-neg">{formError}</p>}
          <div className="flex justify-end">
            <button
              onClick={submitProposal}
              disabled={!title.trim() || busy}
              className="rounded-lg btn-gold px-4 py-2 text-sm disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit Proposal"}
            </button>
          </div>
        </Card>
      )}

      <div className="flex gap-2 border-b border-border pb-0">
        {TAB_META.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-all",
              tab === t.id
                ? "border-border bg-panel text-gold border-gold/40"
                : "border-transparent text-subtle hover:text-fg hover:bg-panel/60",
            ].join(" ")}
          >
            {t.label}
            {data && <span className="text-xs text-subtle">({data.tabs[t.id].length})</span>}
          </button>
        ))}
      </div>

      <p className="text-sm text-subtle">{activeTab.blurb}</p>

      {!loading && data && !data.configured && (
        <Card className="p-4 text-sm text-subtle">
          Connect Notion to populate Proposals.{" "}
          <Link href="/settings" className="text-gold hover:underline">Open Settings</Link>
        </Card>
      )}

      {!loading && data?.error && (
        <Card className="p-4 text-sm text-neg">
          Could not load proposals from Notion: {data.error}
        </Card>
      )}

      <Card className="flex flex-col p-5">
        <SectionTitle title={activeTab.label} action={<span className="text-xs text-subtle">{list.length}</span>} />
        {loading ? (
          <p className="py-6 text-center text-sm text-subtle">Loading…</p>
        ) : list.length === 0 ? (
          <p className="py-6 text-center text-sm text-subtle">
            {tab === "ideas"
              ? "No proposals waiting on formal review."
              : tab === "overview"
                ? "No proposals currently in formal review."
                : "No proposals have a recorded review outcome yet."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {list.map((p) => (
              <li key={p.notionId} className="flex flex-col gap-1.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-fg hover:text-gold"
                  >
                    {p.title || "Untitled"} <ExternalLink size={12} className="shrink-0 text-subtle" />
                  </a>
                  {p.type && <span className="shrink-0 text-xs text-subtle">{p.type}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
                  {p.submittedBy && <span>Submitted by {p.submittedBy}</span>}
                  {p.created && <span>· {fmtDate(p.created)}</span>}
                  {p.reviewOwner && <span>· Owner: {p.reviewOwner}</span>}
                </div>
                {tab === "reviewed" && (
                  <div className="mt-1 rounded-lg border border-border bg-[var(--bg-elevated)]/40 p-2.5">
                    <p className={`text-sm font-semibold ${decisionTone(p.decision)}`}>
                      {p.decision || "Pending"}
                    </p>
                    {p.decisionRationale && (
                      <p className="mt-1 text-xs text-subtle">{p.decisionRationale}</p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

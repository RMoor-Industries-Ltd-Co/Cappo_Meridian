"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/Card";

interface TagOption { id: string; name: string }

const CAPTURE_TYPES = ["Idea", "Product", "Terminology", "Task", "Document"];
const SOURCES = ["Fathom", "Gemini", "ClickUp", "Notion", "Other"];

const inputCls =
  "w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none";

/**
 * Dashboard-native intake: "+ New Entry" → Capture/Ideas, and "+ Meeting" →
 * Meeting Notes. Writes straight into Notion via /api/wiki/* and routes by
 * Domain/Brand so entries land in the proper place.
 */
export function WikiQuickAdd({ onAdded }: { onAdded?: () => void }) {
  const [open, setOpen] = useState<null | "capture" | "meeting">(null);
  const [domains, setDomains] = useState<TagOption[]>([]);
  const [brands, setBrands] = useState<TagOption[]>([]);
  const [busy, setBusy] = useState(false);

  // capture fields
  const [cTitle, setCTitle] = useState("");
  const [cType, setCType] = useState("Idea");
  const [cDomain, setCDomain] = useState("");
  const [cBrand, setCBrand] = useState("");
  const [cNotes, setCNotes] = useState("");

  // meeting fields
  const [mTitle, setMTitle] = useState("");
  const [mDate, setMDate] = useState("");
  const [mSource, setMSource] = useState("Fathom");
  const [mLink, setMLink] = useState("");
  const [mSummary, setMSummary] = useState("");
  const [mDomain, setMDomain] = useState("");

  useEffect(() => {
    fetch("/api/wiki/options")
      .then((r) => r.json())
      .then((d: { brands: TagOption[]; domains: TagOption[] }) => {
        setDomains(d.domains ?? []);
        setBrands(d.brands ?? []);
      })
      .catch(() => {});
  }, []);

  async function submitCapture() {
    if (!cTitle.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/wiki/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cTitle.trim(),
          type: cType,
          domainId: cDomain || undefined,
          brandId: cBrand || undefined,
          notes: cNotes || undefined,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(e.error || "Could not add entry");
        return;
      }
      setCTitle("");
      setCNotes("");
      setOpen(null);
      onAdded?.();
    } finally {
      setBusy(false);
    }
  }

  async function submitMeeting() {
    if (!mTitle.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/wiki/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: mTitle.trim(),
          date: mDate || undefined,
          source: mSource,
          link: mLink || undefined,
          summary: mSummary || undefined,
          domainId: mDomain || undefined,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(e.error || "Could not add meeting note");
        return;
      }
      setMTitle("");
      setMLink("");
      setMSummary("");
      setOpen(null);
      onAdded?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(open === "capture" ? null : "capture")}
          className="flex items-center gap-1.5 rounded-lg btn-gold px-3 py-2 text-sm"
        >
          <Plus size={15} /> New Entry
        </button>
        <button
          onClick={() => setOpen(open === "meeting" ? null : "meeting")}
          className="flex items-center gap-1.5 rounded-lg border border-border-strong bg-panel px-3 py-2 text-sm text-fg hover:bg-gold/10"
        >
          <CalendarPlus size={15} /> Meeting
        </button>
      </div>

      {open === "capture" && (
        <Card gold className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-fg">New Entry → Capture / Ideas</h3>
            <button onClick={() => setOpen(null)} className="text-subtle hover:text-fg"><X size={15} /></button>
          </div>
          <input autoFocus value={cTitle} onChange={(e) => setCTitle(e.target.value)} placeholder="Title…" className={inputCls} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select value={cType} onChange={(e) => setCType(e.target.value)} className={inputCls}>
              {CAPTURE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={cDomain} onChange={(e) => setCDomain(e.target.value)} className={inputCls}>
              <option value="">Domain…</option>
              {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={cBrand} onChange={(e) => setCBrand(e.target.value)} className={inputCls}>
              <option value="">Brand…</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <textarea value={cNotes} onChange={(e) => setCNotes(e.target.value)} placeholder="Notes (optional)…" rows={2} className={inputCls} />
          <div className="flex justify-end">
            <button onClick={submitCapture} disabled={!cTitle.trim() || busy} className="rounded-lg btn-gold px-4 py-2 text-sm disabled:opacity-50">
              {busy ? "Adding…" : "Add to Notion"}
            </button>
          </div>
        </Card>
      )}

      {open === "meeting" && (
        <Card gold className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-fg">New Meeting Note</h3>
            <button onClick={() => setOpen(null)} className="text-subtle hover:text-fg"><X size={15} /></button>
          </div>
          <input autoFocus value={mTitle} onChange={(e) => setMTitle(e.target.value)} placeholder="Meeting title…" className={inputCls} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} className={inputCls} title="Date" />
            <select value={mSource} onChange={(e) => setMSource(e.target.value)} className={inputCls}>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={mDomain} onChange={(e) => setMDomain(e.target.value)} className={inputCls}>
              <option value="">Domain…</option>
              {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <input value={mLink} onChange={(e) => setMLink(e.target.value)} placeholder="Source link (Fathom / Gemini Doc / ClickUp / Notion URL)…" className={inputCls} />
          <textarea value={mSummary} onChange={(e) => setMSummary(e.target.value)} placeholder="Summary / notes (shown in the dashboard)…" rows={3} className={inputCls} />
          <div className="flex justify-end">
            <button onClick={submitMeeting} disabled={!mTitle.trim() || busy} className="rounded-lg btn-gold px-4 py-2 text-sm disabled:opacity-50">
              {busy ? "Adding…" : "Add Meeting Note"}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

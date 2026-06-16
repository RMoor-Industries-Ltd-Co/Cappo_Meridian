"use client";

import { useEffect, useRef, useState } from "react";
import { PhoneCall, Clock, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { PLAYBOOKS, fillScript, suggestPlaybook, type ScriptStage } from "@/lib/callScripts";

interface Supplier {
  id?: string;
  name: string;
  contact_name?: string | null;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  location?: string | null;
  timezone?: string | null;
  category?: string | null;
  source?: string | null;
  stage?: string | null;
  interest?: string | null;
  moq?: string | null;
  lead_time?: string | null;
  price_tiers?: string | null;
  payment_terms?: string | null;
  sample_available?: boolean | null;
  sample_cost?: string | null;
  private_label?: boolean | null;
  certifications?: string | null;
  catalog_url?: string | null;
  shipping_origin?: string | null;
}

const EMPTY: Supplier = { name: "", category: "Candles", stage: "new" };

const IDENTITY: { k: keyof Supplier; label: string; type?: string }[] = [
  { k: "name", label: "Company *" },
  { k: "contact_name", label: "Contact name" },
  { k: "role", label: "Role / title" },
  { k: "phone", label: "Phone", type: "tel" },
  { k: "email", label: "Email", type: "email" },
  { k: "website", label: "Website" },
  { k: "location", label: "Location" },
  { k: "timezone", label: "Timezone" },
  { k: "source", label: "Source" },
];
const CATEGORIES = ["Candles", "Incense", "Burning oils", "Lounge goods", "Packaging", "Fragrance / raw", "Other"];
const TERMS: { k: keyof Supplier; label: string }[] = [
  { k: "moq", label: "MOQ" },
  { k: "lead_time", label: "Lead time" },
  { k: "price_tiers", label: "Price / tiers" },
  { k: "payment_terms", label: "Payment terms" },
  { k: "sample_cost", label: "Sample cost" },
  { k: "certifications", label: "Certifications" },
  { k: "catalog_url", label: "Catalog URL" },
  { k: "shipping_origin", label: "Shipping origin" },
];
const OUTCOMES = [
  { label: "Reached", hot: false },
  { label: "Voicemail", hot: false },
  { label: "No Answer", hot: false },
  { label: "Call Back", hot: true },
  { label: "Ordered Sample", hot: true },
  { label: "Submit for Next Steps", hot: true },
  { label: "Not Interested", hot: false },
  { label: "OOB", hot: false },
];

function mmss(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function ContactCenter() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [rep, setRep] = useState("");
  const [form, setForm] = useState<Supplier>(EMPTY);
  const [notes, setNotes] = useState("");
  const [callbackAt, setCallbackAt] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [startedAt] = useState(() => new Date());
  const [pbId, setPbId] = useState("general");
  const [stageIdx, setStageIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ msg: string; url?: string | null } | null>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    Promise.resolve(localStorage.getItem("cc_rep")).then((v) => v && setRep(v));
    fetch("/api/contacts").then((r) => r.json()).then((d) => setSuppliers(d.suppliers ?? [])).catch(() => {});
  }, []);

  function set<K extends keyof Supplier>(k: K, v: Supplier[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function pick(id: string) {
    if (!id) {
      setForm(EMPTY);
      setNotes("");
      return;
    }
    const d = await fetch(`/api/contacts/${id}`).then((r) => r.json()).catch(() => null);
    if (d?.supplier) {
      setForm(d.supplier);
      setNotes("");
    }
  }

  function stamp() {
    const t = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    setNotes((n) => (n ? `${n}\n[${t}] ` : `[${t}] `));
    notesRef.current?.focus();
  }

  const ctx: Record<string, string> = {
    rep: rep || "Alex",
    contact: form.contact_name || "there",
    company: form.name || "your team",
    category: (form.category || "home goods").toLowerCase(),
  };
  const pb = PLAYBOOKS.find((p) => p.id === pbId) ?? PLAYBOOKS[0];
  const stage = pb.stages[Math.min(stageIdx, pb.stages.length - 1)];
  const suggestedId = suggestPlaybook(form.category);

  function pickPlaybook(id: string) {
    setPbId(id);
    setStageIdx(0);
  }

  function insertStage(s: ScriptStage) {
    const t = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const extra = s.checklist ? "\n" + s.checklist.map((q) => `  • ${fillScript(q, ctx)}: `).join("\n") : "";
    setNotes((n) => `${n ? n + "\n" : ""}[${t}] ${pb.name} · ${s.label}${extra}\n`);
    notesRef.current?.focus();
  }

  async function save(outcome: string) {
    if (!form.name.trim()) {
      setResult({ msg: "Add a company name first." });
      return;
    }
    if (rep) localStorage.setItem("cc_rep", rep);
    const cb = outcome === "Call Back" ? callbackAt || null : null;
    setSaving(true);
    setResult(null);
    try {
      const r = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier: form,
          call: { rep, outcome, notes, durationSeconds: seconds, callbackAt: cb },
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setResult({ msg: d.error || "Save failed" });
      } else {
        setForm(d.supplier);
        setSuppliers((s) => {
          const others = s.filter((x) => x.id !== d.supplier.id);
          return [d.supplier, ...others];
        });
        setResult({
          msg: `Saved · ${outcome} · stage: ${d.supplier.stage}`,
          url: d.call?.clickup_url,
        });
      }
    } catch (e) {
      setResult({ msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-fg placeholder:text-subtle focus:border-gold focus:outline-none";

  return (
    <div className="flex flex-col gap-4 pb-28 pt-2">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-strong bg-panel text-gold">
          <PhoneCall size={22} strokeWidth={1.75} />
        </span>
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold text-fg">Contact Center</h1>
          <p className="text-sm text-subtle">Outbound calls to suppliers, wholesalers & contractors — HVN sourcing.</p>
        </div>
        <input
          value={rep}
          onChange={(e) => setRep(e.target.value)}
          placeholder="Your name (rep)"
          className={`${inputCls} w-40`}
        />
        <div className="flex items-center gap-1.5 rounded-md border border-border-strong bg-panel px-3 py-1.5 text-sm text-gold">
          <Clock size={15} /> {mmss(seconds)}
        </div>
      </div>

      {/* Lead picker */}
      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <select onChange={(e) => pick(e.target.value)} value={form.id ?? ""} className={`${inputCls} w-72`}>
          <option value="">— New lead —</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.contact_name ? ` · ${s.contact_name}` : ""}
              {s.stage ? ` (${s.stage})` : ""}
            </option>
          ))}
        </select>
        {form.stage && (
          <span className="rounded-full bg-gold/15 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-gold">
            {form.stage}
          </span>
        )}
        <span suppressHydrationWarning className="text-xs text-subtle">Started {startedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left: identity + script */}
        <div className="flex flex-col gap-4">
          <div className="panel p-4">
            <h2 className="mb-3 text-sm font-semibold text-fg">Lead</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {IDENTITY.map((f) => (
                <label key={f.k} className="flex flex-col gap-1 text-xs text-subtle">
                  {f.label}
                  <input
                    type={f.type ?? "text"}
                    value={(form[f.k] as string) ?? ""}
                    onChange={(e) => set(f.k, e.target.value)}
                    className={inputCls}
                  />
                </label>
              ))}
              <label className="flex flex-col gap-1 text-xs text-subtle">
                Category
                <select value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} className={inputCls}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            {form.phone && (
              <a href={`tel:${form.phone}`} className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-gold/40 px-3 py-1.5 text-sm text-gold hover:bg-gold/10">
                <PhoneCall size={14} /> Call {form.phone}
              </a>
            )}
          </div>

          <div className="panel panel-gold p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="mr-auto text-sm font-semibold text-fg">Call Flow</h2>
              <select value={pbId} onChange={(e) => pickPlaybook(e.target.value)} className={`${inputCls} w-auto`}>
                {PLAYBOOKS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {suggestedId !== pbId && (
              <button
                onClick={() => pickPlaybook(suggestedId)}
                className="mb-3 w-full rounded-md border border-gold/40 px-2.5 py-1.5 text-left text-xs text-gold hover:bg-gold/10"
              >
                Suggested for “{form.category}”: {PLAYBOOKS.find((p) => p.id === suggestedId)?.name} — tap to switch
              </button>
            )}

            <div className="mb-3 grid gap-1 text-xs text-subtle">
              <span><span className="font-medium text-muted">Who:</span> {pb.who}</span>
              <span><span className="font-medium text-muted">Lead with:</span> {pb.leadWith}</span>
              <span><span className="font-medium text-muted">Key phrase:</span> “{pb.keyPhrase}”</span>
            </div>

            {/* Stage pills */}
            <div className="mb-3 flex flex-wrap gap-1">
              {pb.stages.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setStageIdx(i)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    i === stageIdx ? "btn-gold" : "border border-border text-subtle hover:text-fg"
                  }`}
                >
                  {i + 1}. {s.label}
                </button>
              ))}
            </div>

            {/* Active stage */}
            <div className="rounded-lg border border-border bg-bg/40 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gold">{stage.goal}</p>
              {stage.lines && (
                <div className="flex flex-col gap-2">
                  {stage.lines.map((ln, i) => (
                    <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{fillScript(ln, ctx)}</p>
                  ))}
                </div>
              )}
              {stage.checklist && (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {stage.checklist.map((q) => (
                    <li key={q} className="flex items-start gap-2 text-sm text-muted">
                      <span className="mt-0.5 text-gold">•</span>
                      <span>{fillScript(q, ctx)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {stage.coaching && (
                <p className="mt-3 rounded-md bg-gold/10 px-2.5 py-1.5 text-xs italic text-subtle">
                  Coach: {stage.coaching}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <button onClick={() => insertStage(stage)} className="rounded-md border border-border px-2 py-1 text-xs text-gold hover:bg-gold/10">
                  + log to notes
                </button>
                <div className="flex gap-1">
                  <button
                    disabled={stageIdx === 0}
                    onClick={() => setStageIdx((i) => Math.max(0, i - 1))}
                    className="rounded-md border border-border p-1 text-muted hover:text-fg disabled:opacity-30"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={stageIdx === pb.stages.length - 1}
                    onClick={() => setStageIdx((i) => Math.min(pb.stages.length - 1, i + 1))}
                    className="rounded-md border border-border p-1 text-muted hover:text-fg disabled:opacity-30"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-subtle hover:text-fg">Before you dial — prep checklist</summary>
              <ul className="mt-1.5 flex flex-col gap-1 pl-1">
                {pb.prep.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-muted"><span className="mt-0.5 text-gold">✓</span><span>{p}</span></li>
                ))}
              </ul>
            </details>
            <details className="mt-1.5 text-xs">
              <summary className="cursor-pointer text-red-400/80 hover:text-red-400">Red flags — walk away signals</summary>
              <ul className="mt-1.5 flex flex-col gap-1 pl-1">
                {pb.redFlags.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-muted"><span className="mt-0.5 text-red-400/80">🚩</span><span>{f}</span></li>
                ))}
              </ul>
            </details>
          </div>
        </div>

        {/* Right: capture + notes */}
        <div className="flex flex-col gap-4">
          <div className="panel p-4">
            <h2 className="mb-3 text-sm font-semibold text-fg">Capture</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {TERMS.map((f) => (
                <label key={f.k} className="flex flex-col gap-1 text-xs text-subtle">
                  {f.label}
                  <input
                    value={(form[f.k] as string) ?? ""}
                    onChange={(e) => set(f.k, e.target.value)}
                    className={inputCls}
                  />
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!form.sample_available} onChange={(e) => set("sample_available", e.target.checked)} />
                Samples available
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!form.private_label} onChange={(e) => set("private_label", e.target.checked)} />
                Private label / custom
              </label>
              <span className="flex items-center gap-2">
                Interest:
                {["Hot", "Warm", "Cold"].map((i) => (
                  <label key={i} className="flex items-center gap-1">
                    <input type="radio" name="interest" checked={form.interest === i} onChange={() => set("interest", i)} /> {i}
                  </label>
                ))}
              </span>
            </div>
          </div>

          <div className="panel p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-fg">Call notes</h2>
              <button onClick={stamp} className="rounded-md border border-border px-2 py-1 text-xs text-gold hover:bg-gold/10">
                + timestamp
              </button>
            </div>
            <textarea
              ref={notesRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={7}
              placeholder="What was said, objections, who to follow up with…"
              className={`${inputCls} resize-y`}
            />
          </div>
        </div>
      </div>

      {/* Outcome bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-panel/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={callbackAt}
            onChange={(e) => setCallbackAt(e.target.value)}
            title="Call-back time (used by Call Back)"
            className={`${inputCls} w-52`}
          />
          {OUTCOMES.map((o) => (
            <button
              key={o.label}
              disabled={saving}
              onClick={() => save(o.label)}
              className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                o.hot ? "btn-gold" : "border border-border-strong text-muted hover:text-fg"
              }`}
            >
              {o.label}
            </button>
          ))}
          {result && (
            <span className="ml-auto flex items-center gap-2 text-xs text-subtle">
              {result.msg}
              {result.url && (
                <a href={result.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gold hover:underline">
                  task <ExternalLink size={12} />
                </a>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

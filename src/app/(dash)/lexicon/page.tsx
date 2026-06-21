"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Search, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";

interface LexiconTerm {
  id: string;
  name: string;
  category: string;
  meaning: string;
  use: string;
  plainMeaning: string;
  example: string;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const CATEGORY_ORDER = [
  "All",
  "Brand Language",
  "Atmos Chambers",
  "Prime Anchors",
  "Tempering Reservoirs",
  "Ember Lines",
  "Sanctum",
  "Product Formats",
];

const CATEGORY_COLORS: Record<string, string> = {
  "Brand Language": "text-gold border-gold/40 bg-gold/10",
  "Atmos Chambers": "text-sky-400 border-sky-400/30 bg-sky-400/10",
  "Prime Anchors": "text-violet-400 border-violet-400/30 bg-violet-400/10",
  "Tempering Reservoirs": "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  "Ember Lines": "text-orange-400 border-orange-400/30 bg-orange-400/10",
  "Sanctum": "text-red-400 border-red-400/30 bg-red-400/10",
  "Product Formats": "text-blue-400 border-blue-400/30 bg-blue-400/10",
};

const CATEGORY_DOT: Record<string, string> = {
  "Brand Language": "bg-gold",
  "Atmos Chambers": "bg-sky-400",
  "Prime Anchors": "bg-violet-400",
  "Tempering Reservoirs": "bg-emerald-400",
  "Ember Lines": "bg-orange-400",
  "Sanctum": "bg-red-400",
  "Product Formats": "bg-blue-400",
};

export default function LexiconPage() {
  const [terms, setTerms] = useState<LexiconTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState("");

  const [letter, setLetter] = useState<string>("All");
  const [category, setCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LexiconTerm | null>(null);

  function load() {
    setLoading(true);
    setError("");
    fetch("/api/lexicon")
      .then((r) => r.json())
      .then((d: { configured: boolean; terms: LexiconTerm[]; error?: string }) => {
        setConfigured(d.configured);
        setTerms(d.terms ?? []);
        if (d.terms?.length) setSelected(d.terms[0]);
        if (d.error) setError(d.error);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let active = true;
    fetch("/api/lexicon")
      .then((r) => r.json())
      .then((d: { configured: boolean; terms: LexiconTerm[]; error?: string }) => {
        if (!active) return;
        setConfigured(d.configured);
        setTerms(d.terms ?? []);
        if (d.terms?.length) setSelected(d.terms[0]);
        if (d.error) setError(d.error);
      })
      .catch((e: Error) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const existingLetters = useMemo(
    () => new Set(terms.map((t) => t.name[0]?.toUpperCase())),
    [terms],
  );

  const categories = useMemo(() => {
    const present = new Set(terms.map((t) => t.category));
    return CATEGORY_ORDER.filter((c) => c === "All" || present.has(c));
  }, [terms]);

  const filtered = useMemo(() => {
    return terms.filter((t) => {
      if (letter !== "All" && t.name[0]?.toUpperCase() !== letter) return false;
      if (category !== "All" && t.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.meaning.toLowerCase().includes(q) ||
          t.plainMeaning.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [terms, letter, category, search]);

  function pickLetter(l: string) {
    setLetter(l);
    if (filtered.length && filtered[0].name[0]?.toUpperCase() !== l && l !== "All") {
      const first = terms.find((t) => t.name[0]?.toUpperCase() === l);
      if (first) setSelected(first);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col gap-3 pt-2">
      {/* ── A–Z row ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1">
        <button
          onClick={() => setLetter("All")}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
            letter === "All"
              ? "bg-gold/20 text-gold"
              : "text-subtle hover:bg-white/5 hover:text-muted"
          }`}
        >
          All
        </button>
        {ALPHABET.map((l) => (
          <button
            key={l}
            onClick={() => pickLetter(l)}
            disabled={!existingLetters.has(l)}
            className={`w-7 rounded-lg py-1 text-xs font-semibold transition-colors ${
              letter === l
                ? "bg-gold/20 text-gold"
                : existingLetters.has(l)
                ? "text-subtle hover:bg-white/5 hover:text-muted"
                : "cursor-default text-border"
            }`}
          >
            {l}
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-subtle hover:text-muted"
          title="Refresh"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── Category row ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              category === c
                ? c === "All"
                  ? "border-gold/40 bg-gold/10 text-gold"
                  : (CATEGORY_COLORS[c] ?? "border-border bg-panel text-muted")
                : "border-border text-subtle hover:border-border-strong hover:text-muted"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* ── Main body ────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Left: search + term list */}
        <div className="flex w-64 shrink-0 flex-col gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search terms…"
              className="w-full rounded-lg border border-border bg-panel py-2 pl-8 pr-3 text-sm text-fg placeholder:text-subtle focus:border-gold/50 focus:outline-none"
            />
          </div>

          <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-panel">
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <RefreshCw size={16} className="animate-spin text-subtle" />
              </div>
            ) : !configured ? (
              <p className="p-4 text-xs text-subtle">Connect Notion to load the Lexicon.</p>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-xs text-subtle">No terms match your filters.</p>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => setSelected(t)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                        selected?.id === t.id
                          ? "bg-gold/10 text-gold"
                          : "text-fg hover:bg-white/5"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${CATEGORY_DOT[t.category] ?? "bg-border-strong"}`}
                      />
                      <span className="min-w-0 truncate text-sm">{t.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!loading && filtered.length > 0 && (
            <p className="text-center text-[11px] text-subtle">
              {filtered.length} {filtered.length === 1 ? "term" : "terms"}
            </p>
          )}
        </div>

        {/* Right: term detail */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          {error && (
            <Card className="mb-4 border-neg/30 bg-neg/5 p-4 text-sm text-neg">{error}</Card>
          )}

          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <BookOpen size={32} className="text-border-strong" />
              <p className="text-sm text-subtle">Select a term to view its definition.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Term header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-semibold text-fg">{selected.name}</h1>
                  <span
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[selected.category] ?? "border-border text-muted"}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY_DOT[selected.category] ?? "bg-border-strong"}`} />
                    {selected.category}
                  </span>
                </div>
              </div>

              {/* Definition fields */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="flex flex-col gap-2 p-5">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Meaning
                  </h3>
                  <p className="text-sm leading-relaxed text-fg">
                    {selected.meaning || <span className="italic text-subtle">—</span>}
                  </p>
                </Card>

                <Card className="flex flex-col gap-2 p-5">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Plain Meaning
                  </h3>
                  <p className="text-sm leading-relaxed text-fg">
                    {selected.plainMeaning || <span className="italic text-subtle">—</span>}
                  </p>
                </Card>

                <Card className="flex flex-col gap-2 p-5 lg:col-span-2">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    When to Use
                  </h3>
                  <p className="text-sm leading-relaxed text-fg">
                    {selected.use || <span className="italic text-subtle">—</span>}
                  </p>
                </Card>

                {selected.example && (
                  <Card gold className="flex flex-col gap-2 p-5 lg:col-span-2">
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Example
                    </h3>
                    <blockquote className="border-l-2 border-gold pl-4 text-sm italic leading-relaxed text-fg">
                      {selected.example}
                    </blockquote>
                  </Card>
                )}
              </div>

              {/* Navigation hint */}
              {filtered.length > 1 && (
                <div className="flex items-center gap-3 pt-1">
                  {(() => {
                    const idx = filtered.findIndex((t) => t.id === selected.id);
                    const prev = idx > 0 ? filtered[idx - 1] : null;
                    const next = idx < filtered.length - 1 ? filtered[idx + 1] : null;
                    return (
                      <>
                        {prev && (
                          <button
                            onClick={() => setSelected(prev)}
                            className="text-xs text-subtle hover:text-gold"
                          >
                            ← {prev.name}
                          </button>
                        )}
                        {next && (
                          <button
                            onClick={() => setSelected(next)}
                            className="ml-auto text-xs text-subtle hover:text-gold"
                          >
                            {next.name} →
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

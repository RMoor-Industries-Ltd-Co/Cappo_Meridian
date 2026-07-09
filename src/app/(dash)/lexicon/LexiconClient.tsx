"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

interface Term {
  term: string;
  meaning: string;
  use: string;
  plain: string;
  example: string;
  formula?: string;
  image?: string;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function LexiconClient({ terms }: { terms: Term[] }) {
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<Term | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const lettersWithTerms = new Set(terms.map((t) => t.term[0].toUpperCase()));

  const filtered =
    activeLetter
      ? terms.filter((t) => t.term[0].toUpperCase() === activeLetter)
      : terms;

  useEffect(() => {
    if (!selectedTerm) return;
    function onDown(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setSelectedTerm(null);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [selectedTerm]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedTerm(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-col gap-6 pt-2">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gold">Lexicon</h1>
        <p className="mt-1 text-sm text-subtle">
          The language of HVN — terms, definitions, and operating vocabulary.
        </p>
      </div>

      {/* Alphabet nav */}
      <div className="sticky top-0 z-10 -mx-6 bg-background/80 px-6 py-3 backdrop-blur-sm border-b border-border">
        <div className="flex flex-wrap gap-x-1 gap-y-1">
          <button
            onClick={() => setActiveLetter(null)}
            className={[
              "min-w-[2rem] rounded px-2 py-1 text-sm font-medium transition-all",
              "hover:[filter:drop-shadow(0_0_8px_rgba(232,184,75,0.65))]",
              activeLetter === null
                ? "font-bold text-gold [filter:drop-shadow(0_0_8px_rgba(232,184,75,0.7))]"
                : "text-gold/50 hover:text-gold",
            ].join(" ")}
          >
            All
          </button>
          {ALPHABET.map((letter) => {
            const hasTerms = lettersWithTerms.has(letter);
            const isActive = activeLetter === letter;
            return (
              <button
                key={letter}
                onClick={() => hasTerms && setActiveLetter(isActive ? null : letter)}
                disabled={!hasTerms}
                className={[
                  "min-w-[1.75rem] rounded px-1.5 py-1 text-sm transition-all",
                  hasTerms ? "cursor-pointer" : "cursor-default select-none",
                  isActive
                    ? "font-bold text-gold [filter:drop-shadow(0_0_8px_rgba(232,184,75,0.7))]"
                    : hasTerms
                    ? "font-medium text-gold/60 hover:text-gold hover:[filter:drop-shadow(0_0_8px_rgba(232,184,75,0.65))]"
                    : "text-gold/15",
                ].join(" ")}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-subtle">
        {filtered.length} {filtered.length === 1 ? "term" : "terms"}
        {activeLetter ? ` under ${activeLetter}` : ""}
      </p>

      {/* Terms grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <button
            key={t.term}
            onClick={() => setSelectedTerm(t)}
            className="group flex flex-col gap-1 rounded-xl border border-border bg-panel px-4 py-3 text-left transition-colors hover:border-gold/40 hover:bg-panel-2"
          >
            <span className="text-sm font-semibold text-gold group-hover:text-gold-bright transition-colors">
              {t.term}
            </span>
            <span className="line-clamp-2 text-xs text-subtle">{t.plain}</span>
          </button>
        ))}
      </div>

      {/* Modal */}
      {selectedTerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            ref={modalRef}
            className="relative w-full max-w-2xl rounded-2xl border border-border-strong bg-panel shadow-2xl max-h-[90dvh] overflow-y-auto"
          >
            {/* Gold top accent */}
            <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

            {/* Image — full-width hero */}
            {selectedTerm.image && (
              <div className="w-full overflow-hidden rounded-t-2xl">
                <img
                  src={selectedTerm.image}
                  alt={selectedTerm.term}
                  className="w-full h-72 object-cover"
                  // Hide the frame entirely if the image can't load, rather than
                  // leaving a broken-image icon.
                  onError={(e) => {
                    (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            )}

            <div className="p-6">
              {/* Title + close */}
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-semibold text-gold leading-tight">
                  {selectedTerm.term}
                </h2>
                <button
                  onClick={() => setSelectedTerm(null)}
                  className="mt-0.5 flex-shrink-0 rounded-lg p-1.5 text-subtle hover:bg-white/5 hover:text-fg transition-colors"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-5 flex flex-col gap-4">
                {selectedTerm.formula && (
                  <div className="rounded-lg border border-gold/20 bg-gold/5 px-3 py-2">
                    <span className="block mb-0.5 text-xs font-semibold uppercase tracking-wider text-gold/60">
                      Visual Formula
                    </span>
                    <p className="text-sm text-gold/90 font-medium">{selectedTerm.formula}</p>
                  </div>
                )}
                <Row label="Meaning" value={selectedTerm.meaning} />
                <Row label="Plain meaning" value={selectedTerm.plain} />
                <Row label="Use" value={selectedTerm.use} />
                <div>
                  <span className="block mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
                    Example
                  </span>
                  <p className="text-sm italic text-fg/70 border-l-2 border-gold/30 pl-3">
                    {selectedTerm.example}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block mb-0.5 text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </span>
      <p className="text-sm text-fg/85">{value}</p>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  FlaskConical,
  Folder,
  FileText,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Lock,
  ArrowUp,
  ChevronRight,
} from "lucide-react";
import { Starburst } from "@/components/brand/Starburst";

interface ProjectNode {
  name: string;
  files: string[];
  responses: string[];
}

// Illustrative structure — real folders/files/responses will hydrate from the
// connected Claude account once OAuth + the Claude API are wired in.
const PROJECTS: ProjectNode[] = [
  {
    name: "Market Sizing — Q3",
    files: ["competitor-landscape.pdf", "tam-sam-som.xlsx"],
    responses: ["Summarize competitor pricing", "Draft TAM model"],
  },
  {
    name: "Product Research",
    files: ["user-interviews.docx", "feature-matrix.csv"],
    responses: ["Synthesize interview themes"],
  },
  {
    name: "Brand & Positioning",
    files: ["positioning-brief.md"],
    responses: [],
  },
];

export default function ResearchPage() {
  const [railOpen, setRailOpen] = useState(true);
  const [openProject, setOpenProject] = useState<string | null>(PROJECTS[0].name);

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4 pt-2">
      {/* Collapsible side rail: projects → files / responses */}
      <aside
        className={`panel flex shrink-0 flex-col transition-all duration-200 ${
          railOpen ? "w-72" : "w-12"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border p-3">
          {railOpen && (
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Research Projects
            </span>
          )}
          <button
            onClick={() => setRailOpen((v) => !v)}
            className="text-subtle hover:text-fg"
            title={railOpen ? "Collapse" : "Expand"}
          >
            {railOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
        </div>

        {railOpen && (
          <div className="flex-1 overflow-y-auto p-2">
            {PROJECTS.map((p) => {
              const isOpen = openProject === p.name;
              return (
                <div key={p.name} className="mb-1">
                  <button
                    onClick={() => setOpenProject(isOpen ? null : p.name)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-fg hover:bg-white/5"
                  >
                    <ChevronRight
                      size={14}
                      className={`shrink-0 text-subtle transition-transform ${
                        isOpen ? "rotate-90" : ""
                      }`}
                    />
                    <Folder size={15} className="shrink-0 text-gold" />
                    <span className="truncate">{p.name}</span>
                  </button>
                  {isOpen && (
                    <div className="ml-6 flex flex-col gap-0.5 border-l border-border pl-2">
                      {p.files.map((f) => (
                        <span
                          key={f}
                          className="flex items-center gap-2 rounded px-2 py-1 text-xs text-muted hover:bg-white/5"
                        >
                          <FileText size={13} className="text-subtle" />
                          <span className="truncate">{f}</span>
                        </span>
                      ))}
                      {p.responses.map((r) => (
                        <span
                          key={r}
                          className="flex items-center gap-2 rounded px-2 py-1 text-xs text-muted hover:bg-white/5"
                        >
                          <MessageSquare size={13} className="text-gold/70" />
                          <span className="truncate">{r}</span>
                        </span>
                      ))}
                      {p.files.length === 0 && p.responses.length === 0 && (
                        <span className="px-2 py-1 text-xs text-subtle">Empty</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </aside>

      {/* Main research / chat surface */}
      <section className="panel panel-gold relative flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <FlaskConical size={18} className="text-gold" />
          <h1 className="text-sm font-semibold text-fg">Research Workspace</h1>
          <span className="ml-2 rounded-md bg-gold/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gold">
            Claude · Coming soon
          </span>
        </div>

        {/* Gated state until OAuth + Claude account are connected */}
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="relative">
            <Starburst size={56} className="text-gold" />
            <span className="absolute -right-1 -top-1 text-gold-bright">
              <Sparkles size={18} />
            </span>
          </div>
          <div className="max-w-md">
            <h2 className="text-lg font-semibold text-fg">
              AI research, powered by Claude
            </h2>
            <p className="mt-2 text-sm text-subtle">
              Both partners sign in with the shared AMG Claude account via OAuth, then
              run research right here. Conversations, uploaded files, and Claude&apos;s
              responses are organized into the project rail on the left.
            </p>
          </div>
          <button
            disabled
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-border-strong px-4 py-2 text-sm text-muted"
          >
            <Lock size={15} />
            Connect Claude account (OAuth)
          </button>
          <ul className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-subtle">
            <li>• Shared, separate-from-personal account</li>
            <li>• Sign in from either computer</li>
            <li>• Folders · files · responses auto-tracked</li>
          </ul>
        </div>

        {/* Disabled composer to convey the eventual interaction */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-panel px-4 py-3 opacity-60">
            <input
              disabled
              placeholder="Ask Claude to research…"
              className="flex-1 bg-transparent text-sm text-fg placeholder:text-subtle focus:outline-none"
            />
            <button
              disabled
              className="flex h-8 w-8 items-center justify-center rounded-lg btn-gold opacity-70"
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

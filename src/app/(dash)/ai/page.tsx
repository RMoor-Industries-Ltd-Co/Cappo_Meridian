"use client";

import { useEffect, useRef, useState } from "react";
import {
  Folder,
  FileText,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  ArrowUp,
  ChevronRight,
  Plus,
} from "lucide-react";
import { Starburst } from "@/components/brand/Starburst";

interface ProjectNode {
  name: string;
  files: string[];
  responses: string[];
}
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Illustrative project rail — folders/files/responses will hydrate from a
// datastore once research sessions are persisted (next milestone).
const PROJECTS: ProjectNode[] = [
  { name: "Market Sizing — Q3", files: ["competitor-landscape.pdf", "tam-sam-som.xlsx"], responses: ["Summarize competitor pricing"] },
  { name: "Product Research", files: ["user-interviews.docx"], responses: [] },
  { name: "Brand & Positioning", files: ["positioning-brief.md"], responses: [] },
];

const SUGGESTIONS = [
  "Draft a Q3 go-to-market plan for AMG",
  "Summarize the competitive landscape for our category",
  "What KPIs should we track across the dashboard modules?",
];

export default function AiPage() {
  const [railOpen, setRailOpen] = useState(true);
  const [openProject, setOpenProject] = useState<string | null>(PROJECTS[0].name);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    const appendToLast = (chunk: string) =>
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        copy[copy.length - 1] = { role: "assistant", content: last.content + chunk };
        return copy;
      });

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) {
        const e = await res.json().catch(() => ({}));
        appendToLast(`⚠️ ${e.error || res.statusText}`);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        appendToLast(dec.decode(value, { stream: true }));
      }
    } catch (err) {
      appendToLast(`\n\n⚠️ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setStreaming(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-[calc(100dvh-7rem)] gap-4 pt-2">
      {/* Collapsible project rail */}
      <aside className={`panel flex shrink-0 flex-col transition-all duration-200 ${railOpen ? "w-72" : "w-12"}`}>
        <div className="flex items-center justify-between border-b border-border p-3">
          {railOpen && (
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">AI Projects</span>
          )}
          <button onClick={() => setRailOpen((v) => !v)} className="text-subtle hover:text-fg" title={railOpen ? "Collapse" : "Expand"}>
            {railOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
        </div>
        {railOpen && (
          <div className="flex-1 overflow-y-auto p-2">
            <button className="mb-2 flex w-full items-center gap-2 rounded-lg border border-border-strong px-2 py-2 text-sm text-gold hover:bg-gold/10">
              <Plus size={15} /> New research project
            </button>
            {PROJECTS.map((p) => {
              const isOpen = openProject === p.name;
              return (
                <div key={p.name} className="mb-1">
                  <button onClick={() => setOpenProject(isOpen ? null : p.name)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-fg hover:bg-white/5">
                    <ChevronRight size={14} className={`shrink-0 text-subtle transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    <Folder size={15} className="shrink-0 text-gold" />
                    <span className="truncate">{p.name}</span>
                  </button>
                  {isOpen && (
                    <div className="ml-6 flex flex-col gap-0.5 border-l border-border pl-2">
                      {p.files.map((f) => (
                        <span key={f} className="flex items-center gap-2 rounded px-2 py-1 text-xs text-muted hover:bg-white/5">
                          <FileText size={13} className="text-subtle" /> <span className="truncate">{f}</span>
                        </span>
                      ))}
                      {p.responses.map((r) => (
                        <span key={r} className="flex items-center gap-2 rounded px-2 py-1 text-xs text-muted hover:bg-white/5">
                          <MessageSquare size={13} className="text-gold/70" /> <span className="truncate">{r}</span>
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

      {/* Chat surface */}
      <section className="panel panel-gold relative flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <Sparkles size={18} className="text-gold" />
          <h1 className="text-sm font-semibold text-fg">AI Workspace</h1>
          <span className="ml-2 rounded-md bg-gold/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gold">
            Claude · Opus 4.8
          </span>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {empty ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
              <Starburst size={48} className="text-gold" />
              <div className="max-w-md">
                <h2 className="text-lg font-semibold text-fg">AI research, powered by Claude</h2>
                <p className="mt-2 text-sm text-subtle">Ask anything — strategy, analysis, drafting. Runs on the shared AMG Claude account.</p>
              </div>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-lg border border-border bg-panel px-3 py-2 text-sm text-muted hover:text-fg">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm ${
                      m.role === "user" ? "bg-gold/15 text-fg" : "border border-border bg-panel text-fg"
                    }`}
                  >
                    {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-border bg-panel px-4 py-2.5">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask Claude to research…"
              className="max-h-40 flex-1 resize-none bg-transparent text-sm text-fg placeholder:text-subtle focus:outline-none"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || streaming}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg btn-gold disabled:opacity-40"
              title="Send"
            >
              <ArrowUp size={16} />
            </button>
          </div>
          <p className="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-subtle">
            Claude can be wrong — verify important facts. Conversations aren&apos;t saved yet.
          </p>
        </div>
      </section>
    </div>
  );
}

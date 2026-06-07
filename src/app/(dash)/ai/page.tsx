"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Folder,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  ArrowUp,
  Plus,
  Trash2,
} from "lucide-react";
import { Starburst } from "@/components/brand/Starburst";

interface Project {
  id: string;
  name: string;
}
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Draft a Q3 go-to-market plan for AMG",
  "Summarize the competitive landscape for our category",
  "What KPIs should we track across the dashboard modules?",
];

export default function AiPage() {
  const [railOpen, setRailOpen] = useState(true);
  const [persistent, setPersistent] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load projects on mount (async — only sets state after the fetch resolves).
  useEffect(() => {
    fetch("/api/ai/projects")
      .then((r) => r.json())
      .then((d: { persistent?: boolean; projects?: Project[] }) => {
        setPersistent(!!d.persistent);
        setProjects(d.projects ?? []);
        if (d.persistent && d.projects?.length) setActiveId(d.projects[0].id);
      })
      .catch(() => {});
  }, []);

  // Load a project's conversation when it becomes active.
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    fetch(`/api/ai/projects/${activeId}`)
      .then((r) => r.json())
      .then((d: { messages?: ChatMessage[] }) => {
        if (!cancelled)
          setMessages((d.messages ?? []).map((m) => ({ role: m.role, content: m.content })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function createProject(name: string): Promise<string | null> {
    const res = await fetch("/api/ai/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const d = await res.json().catch(() => ({}));
    if (d.project) {
      setProjects((p) => [d.project, ...p]);
      return d.project.id as string;
    }
    return null;
  }

  function newProjectPrompt() {
    const name = prompt("New research project name");
    if (name?.trim()) createProject(name.trim()).then((id) => id && (setActiveId(id), setMessages([])));
  }

  function removeProject(id: string) {
    if (!confirm("Delete this project and its conversation?")) return;
    fetch(`/api/ai/projects/${id}`, { method: "DELETE" }).finally(() => {
      setProjects((p) => p.filter((x) => x.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
    });
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    // In persistent mode, ensure there's a project to save into.
    let pid = activeId;
    if (persistent && !pid) {
      pid = await createProject(trimmed.slice(0, 48));
      if (pid) setActiveId(pid);
    }

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
        body: JSON.stringify({ messages: next, projectId: pid }),
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
      {/* Project rail */}
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
          <div className="flex flex-1 flex-col overflow-y-auto p-2">
            {persistent ? (
              <>
                <button onClick={newProjectPrompt} className="mb-2 flex w-full items-center gap-2 rounded-lg border border-border-strong px-2 py-2 text-sm text-gold hover:bg-gold/10">
                  <Plus size={15} /> New research project
                </button>
                <button
                  onClick={() => {
                    setActiveId(null);
                    setMessages([]);
                  }}
                  className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${activeId === null ? "bg-gold/15 text-gold" : "text-muted hover:bg-white/5 hover:text-fg"}`}
                >
                  <Sparkles size={15} className="shrink-0" /> New chat
                </button>
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className={`group flex items-center gap-2 rounded-lg px-2 py-2 text-sm ${activeId === p.id ? "bg-gold/15" : "hover:bg-white/5"}`}
                  >
                    <button onClick={() => setActiveId(p.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-fg">
                      <Folder size={15} className="shrink-0 text-gold" />
                      <span className="truncate">{p.name}</span>
                    </button>
                    <button onClick={() => removeProject(p.id)} className="shrink-0 text-subtle opacity-0 transition-opacity hover:text-neg group-hover:opacity-100" title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                {projects.length === 0 && (
                  <p className="px-2 py-4 text-center text-xs text-subtle">No saved projects yet.</p>
                )}
              </>
            ) : (
              <p className="px-2 py-4 text-xs text-subtle">
                Saving is off (no database connected). Conversations are in-session only.
              </p>
            )}
          </div>
        )}
      </aside>

      {/* Chat surface */}
      <section className="panel panel-gold relative flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <Sparkles size={18} className="text-gold" />
          <h1 className="text-sm font-semibold text-fg">
            {activeId ? projects.find((p) => p.id === activeId)?.name ?? "AI Workspace" : "AI Workspace"}
          </h1>
          <span className="ml-2 rounded-md bg-gold/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gold">
            Claude · Opus 4.8
          </span>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {empty ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
              <Starburst size={48} className="text-gold" />
              <div className="max-w-md">
                <h2 className="text-lg font-semibold text-fg">AI research, powered by Claude</h2>
                <p className="mt-2 text-sm text-subtle">
                  Ask anything — strategy, analysis, drafting. Runs on the shared AMG Claude account.
                  {persistent ? " Conversations are saved to your projects." : ""}
                </p>
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
                  {m.role === "user" ? (
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-xl bg-gold/15 px-4 py-2.5 text-sm text-fg">
                      {m.content}
                    </div>
                  ) : (
                    <div className="md max-w-[85%] rounded-xl border border-border bg-panel px-4 py-2.5">
                      {m.content ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      ) : (
                        streaming && i === messages.length - 1 && <span className="text-subtle">…</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

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
            Claude can be wrong — verify important facts.
            {persistent ? "" : " Conversations aren’t saved (no database)."}
          </p>
        </div>
      </section>
    </div>
  );
}

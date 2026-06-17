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
  Pencil,
  Check,
  X,
  Paperclip,
  Loader2,
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
interface ModelOpt {
  id: string;
  label: string;
}
interface ProviderOpt {
  id: string;
  label: string;
  model: string;
  configured: boolean;
  models: ModelOpt[];
}
interface Attachment {
  uid: string;
  name: string;
  mimeType: string;
  status: "uploading" | "ready" | "error";
  driveUrl?: string;
  errorMsg?: string;
}

const SUGGESTIONS = [
  "What's on the AMG ClickUp board right now?",
  "Search the inbox for any unread messages from vendors",
  "Research the top 3 competitors in our category",
];

export default function AiPage() {
  const [railOpen, setRailOpen] = useState(true);
  const [persistent, setPersistent] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [providers, setProviders] = useState<ProviderOpt[]>([]);
  const [provider, setProvider] = useState("claude");
  const [model, setModel] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeProvider = providers.find((p) => p.id === provider);
  const activeLabel = activeProvider?.label ?? "Cappo";
  const isCappo = provider === "claude" || !provider;

  useEffect(() => {
    fetch("/api/ai/providers")
      .then((r) => r.json())
      .then((d: { providers?: ProviderOpt[]; default?: string }) => {
        const list = d.providers ?? [];
        setProviders(list);
        const pick = list.find((p) => p.configured) ?? list.find((p) => p.id === d.default) ?? list[0];
        if (pick) {
          setProvider(pick.id);
          setModel(pick.model);
        }
      })
      .catch(() => {});
  }, []);

  function changeProvider(id: string) {
    setProvider(id);
    setModel(providers.find((p) => p.id === id)?.model ?? "");
  }

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
    return () => { cancelled = true; };
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
      if (activeId === id) { setActiveId(null); setMessages([]); }
    });
  }

  function startRename(p: Project) {
    setRenamingId(p.id);
    setRenameValue(p.name);
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue("");
  }

  async function commitRename(id: string) {
    const name = renameValue.trim();
    if (!name) return cancelRename();
    const res = await fetch(`/api/ai/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const d = await res.json().catch(() => ({}));
    if (d.project) {
      setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, name: d.project.name } : p)));
    }
    cancelRename();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const file of files) {
      const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const att: Attachment = { uid, name: file.name, mimeType: file.type, status: "uploading" };
      setAttachments((a) => [...a, att]);

      const fd = new FormData();
      fd.append("file", file);
      fd.append("parent", "root");
      fetch("/api/drive/upload", { method: "POST", body: fd })
        .then((r) => r.json())
        .then((d) => {
          if (d?.item?.webViewLink) {
            setAttachments((a) =>
              a.map((x) => x.uid === uid ? { ...x, status: "ready", driveUrl: d.item.webViewLink } : x)
            );
          } else {
            setAttachments((a) => a.map((x) => x.uid === uid ? { ...x, status: "error", errorMsg: "Upload failed" } : x));
          }
        })
        .catch(() => {
          setAttachments((a) => a.map((x) => x.uid === uid ? { ...x, status: "error", errorMsg: "Upload failed" } : x));
        });
    }
  }

  function removeAttachment(uid: string) {
    setAttachments((a) => a.filter((x) => x.uid !== uid));
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || streaming) return;

    // Append attachment links to message text
    const readyAtts = attachments.filter((a) => a.status === "ready");
    let fullText = trimmed;
    if (readyAtts.length) {
      fullText += "\n\n" + readyAtts.map((a) => `📎 [${a.name}](${a.driveUrl})`).join("\n");
    }
    setAttachments([]);

    let pid = activeId;
    if (persistent && !pid) {
      pid = await createProject(fullText.slice(0, 48));
      if (pid) setActiveId(pid);
    }

    const next: ChatMessage[] = [...messages, { role: "user", content: fullText }];
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

    // Claude always uses the act (tool-use) path; other providers stream.
    if (isCappo) {
      try {
        const res = await fetch("/api/ai/act", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next, projectId: pid }),
        });
        const d = await res.json().catch(() => ({}));
        appendToLast(res.ok ? d.reply || "(no reply)" : `⚠️ ${d.error || res.statusText}`);
      } catch (err) {
        appendToLast(`⚠️ ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setStreaming(false);
      }
      return;
    }

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, projectId: pid, provider, model }),
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
  const hasUploading = attachments.some((a) => a.status === "uploading");

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
                  onClick={() => { setActiveId(null); setMessages([]); }}
                  className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${activeId === null ? "bg-gold/15 text-gold" : "text-muted hover:bg-white/5 hover:text-fg"}`}
                >
                  <Sparkles size={15} className="shrink-0" /> New chat
                </button>
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm ${activeId === p.id ? "bg-gold/15" : "hover:bg-white/5"}`}
                  >
                    {renamingId === p.id ? (
                      <div className="flex flex-1 items-center gap-1">
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(p.id);
                            if (e.key === "Escape") cancelRename();
                          }}
                          className="min-w-0 flex-1 rounded border border-gold bg-transparent px-1.5 py-0.5 text-xs text-fg focus:outline-none"
                        />
                        <button onClick={() => commitRename(p.id)} className="shrink-0 text-gold hover:text-fg">
                          <Check size={12} />
                        </button>
                        <button onClick={cancelRename} className="shrink-0 text-subtle hover:text-fg">
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => setActiveId(p.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-fg">
                          <Folder size={15} className="shrink-0 text-gold" />
                          <span className="truncate">{p.name}</span>
                        </button>
                        <button
                          onClick={() => startRename(p)}
                          className="shrink-0 text-subtle opacity-0 transition-opacity hover:text-muted group-hover:opacity-100"
                          title="Rename"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => removeProject(p.id)}
                          className="shrink-0 text-subtle opacity-0 transition-opacity hover:text-neg group-hover:opacity-100"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
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
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-subtle">AI</span>
            <select
              value={provider}
              onChange={(e) => changeProvider(e.target.value)}
              className="rounded-md border border-border-strong bg-panel px-2 py-1 text-xs font-medium text-gold focus:outline-none"
              title="Switch AI provider"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.configured ? "" : " (not configured)"}
                </option>
              ))}
            </select>
            {activeProvider && activeProvider.models.length > 0 && (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="rounded-md border border-border bg-panel px-2 py-1 text-xs text-muted focus:outline-none"
                title="Switch model"
              >
                {activeProvider.models.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {empty ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
              <Starburst size={48} className="text-gold" />
              <div className="max-w-md">
                <h2 className="text-lg font-semibold text-fg">
                  {isCappo ? "CAPPO — AMG Operations AI" : `AI research, powered by ${activeLabel}`}
                </h2>
                <p className="mt-2 text-sm text-subtle">
                  {isCappo
                    ? "Ask or tell Cappo anything — he can read and update ClickUp, organise your Gmail, search Drive and Notion, and browse the web."
                    : "Ask anything — strategy, analysis, drafting."}
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
                        streaming && i === messages.length - 1 && (
                          <span className="flex items-center gap-1.5 text-subtle">
                            <Loader2 size={13} className="animate-spin" /> Working…
                          </span>
                        )
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border p-4">
          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-1.5">
              {attachments.map((a) => (
                <div
                  key={a.uid}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                    a.status === "error"
                      ? "border-neg/40 text-neg"
                      : a.status === "uploading"
                      ? "border-border text-subtle"
                      : "border-gold/40 text-muted"
                  }`}
                >
                  {a.status === "uploading" ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Paperclip size={11} />
                  )}
                  <span className="max-w-[140px] truncate">{a.name}</span>
                  <button onClick={() => removeAttachment(a.uid)} className="ml-0.5 text-subtle hover:text-fg">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-border bg-panel px-3 py-2.5">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.pptx,.ppt"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 text-subtle hover:text-muted"
              title="Attach file"
              disabled={streaming}
            >
              <Paperclip size={16} />
            </button>
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
              placeholder={isCappo ? "Ask Cappo anything or tell him to take action…" : `Ask ${activeLabel} to research…`}
              className="max-h-40 flex-1 resize-none bg-transparent text-sm text-fg placeholder:text-subtle focus:outline-none"
            />
            <button
              onClick={() => send(input)}
              disabled={(!input.trim() && attachments.length === 0) || streaming || hasUploading}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg btn-gold disabled:opacity-40"
              title="Send"
            >
              {streaming ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={16} />}
            </button>
          </div>
          <p className="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-subtle">
            {isCappo ? "Cappo can act on AMG systems — verify before sharing externally." : `${activeLabel} can be wrong — verify important facts.`}
            {persistent ? "" : " Conversations aren't saved (no database)."}
          </p>
        </div>
      </section>
    </div>
  );
}

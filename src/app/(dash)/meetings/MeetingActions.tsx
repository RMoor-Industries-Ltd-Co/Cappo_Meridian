"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, RefreshCw, Send, X } from "lucide-react";

interface Preview {
  subject: string;
  html: string;
}

/**
 * Sync / preview / send controls for the meeting digest.
 *
 * Preview is deliberately the prominent path: the digest goes to the board, so
 * the intended workflow is to read it before anyone presses Send.
 */
export function MeetingActions() {
  const router = useRouter();
  const [busy, setBusy] = useState<"sync" | "preview" | "send" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  async function post(path: string, body: Record<string, unknown> = {}) {
    const r = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`);
    return d;
  }

  async function sync() {
    setBusy("sync");
    setMsg(null);
    try {
      const d = await post("/api/meetings/sync");
      const i = d.ingest ?? {};
      const a = d.analysis ?? {};
      setMsg(
        `${i.ingested ?? 0} new transcript(s), ${a.analyzed ?? 0} analyzed · ` +
          `+${a.created ?? 0} / ~${a.updated ?? 0} / ✓${a.closed ?? 0}`,
      );
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function showPreview() {
    setBusy("preview");
    setMsg(null);
    try {
      const d = await post("/api/meetings/digest", { preview: true });
      if (d.empty) setMsg("Nothing to report yet");
      else setPreview({ subject: d.subject, html: d.html });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!confirm("Send today's digest to the board?")) return;
    setBusy("send");
    setMsg(null);
    try {
      const d = await post("/api/meetings/digest");
      setMsg(
        d.status === "sent"
          ? `Sent to ${d.recipients}`
          : d.status === "already-sent"
            ? "Already sent today"
            : "Nothing to report",
      );
      setPreview(null);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const btn =
    "flex items-center gap-1 rounded-md border border-border-strong px-2 py-1 text-xs text-gold hover:bg-gold/10 disabled:opacity-50";

  return (
    <>
      <span className="flex items-center gap-2">
        {msg && <span className="max-w-72 truncate text-xs text-subtle">{msg}</span>}
        <button onClick={sync} disabled={busy !== null} className={btn} title="Pull new transcripts and analyze them">
          <RefreshCw size={13} className={busy === "sync" ? "animate-spin" : ""} />
          {busy === "sync" ? "Syncing…" : "Sync"}
        </button>
        <button onClick={showPreview} disabled={busy !== null} className={btn} title="Compose today's digest without sending">
          <Eye size={13} />
          {busy === "preview" ? "Composing…" : "Preview digest"}
        </button>
      </span>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-6"
          onClick={() => setPreview(null)}
        >
          <div
            className="w-full max-w-2xl rounded-lg border border-border bg-bg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">
                {preview.subject}
              </span>
              <button onClick={send} disabled={busy !== null} className={btn}>
                <Send size={13} />
                {busy === "send" ? "Sending…" : "Send to board"}
              </button>
              <button onClick={() => setPreview(null)} className="text-subtle hover:text-fg">
                <X size={16} />
              </button>
            </div>
            <div
              className="max-h-[70vh] overflow-y-auto"
              // Rendered from our own template around model-written prose, which
              // is HTML-escaped in renderHtml() before it reaches this point.
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          </div>
        </div>
      )}
    </>
  );
}

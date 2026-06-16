"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

/** Triggers the Gmail→Drive harvest of signed legal docs, then refreshes the page. */
export function SyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/legal/harvest", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(d.error || "Sync failed");
      } else {
        setMsg(d.filed > 0 ? `Filed ${d.filed} new` : "Up to date");
        router.refresh();
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      {msg && <span className="text-xs text-subtle">{msg}</span>}
      <button
        onClick={run}
        disabled={busy}
        title="Pull signed PDFs from email into Drive"
        className="flex items-center gap-1 rounded-md border border-border-strong px-2 py-1 text-xs text-gold hover:bg-gold/10 disabled:opacity-50"
      >
        <RefreshCw size={13} className={busy ? "animate-spin" : ""} />
        {busy ? "Syncing…" : "Sync from email"}
      </button>
    </span>
  );
}

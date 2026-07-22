"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Folder,
  FolderOpen,
  ExternalLink,
  Upload,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

interface KFile {
  id: string;
  name: string;
  webViewLink?: string;
  isFolder: boolean;
}
interface KData {
  configured?: boolean;
  connected: boolean;
  folderId?: string;
  folderUrl?: string;
  files: KFile[];
}

/**
 * Per-entity knowledge-bank panel on the Entities page. Lazy-loads the entity's Drive
 * folder (created on first access) and its files, supports uploading documents into it,
 * and links out to Drive. These documents are what Cappo reads when drafting/briefing.
 */
export function EntityKnowledge({ entityCode }: { entityCode: string; entityName?: string }) {
  const [data, setData] = useState<KData | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    setBusy(true);
    try {
      const r = await fetch(`/api/grantops/knowledge?entity=${encodeURIComponent(entityCode)}`);
      setData(await r.json());
    } catch {
      setData({ connected: false, files: [] });
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !data) load();
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !data?.folderId) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("parent", data.folderId);
    try {
      const res = await fetch("/api/drive/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Upload failed");
      }
      await load();
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  const docs = (data?.files ?? []).filter((f) => !f.isFolder);
  const subfolders = (data?.files ?? []).filter((f) => f.isFolder);

  return (
    <div className="mt-3 rounded-md border border-border bg-panel-2/50">
      <button
        onClick={toggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-fg hover:text-gold"
      >
        <ChevronRight size={14} className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        {open ? <FolderOpen size={15} className="text-gold" /> : <Folder size={15} className="text-gold" />}
        <span className="font-medium">Knowledge base (Drive)</span>
        <span className="ml-auto text-xs text-subtle">
          {data ? (data.connected ? `${docs.length} file${docs.length === 1 ? "" : "s"}` : "not connected") : "Drive"}
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-3 py-3">
          {!data || busy ? (
            <p className="text-xs text-subtle">Loading…</p>
          ) : data.configured === false ? (
            <p className="text-xs text-subtle">
              Google isn&apos;t configured.{" "}
              <Link href="/settings" className="text-gold hover:underline">Open Settings</Link>
            </p>
          ) : !data.connected ? (
            <p className="text-xs text-subtle">
              Drive isn&apos;t connected.{" "}
              <a href="/api/connectors/google/authorize" className="text-gold hover:underline">Connect Google Drive</a>{" "}
              to store and read this entity&apos;s documents.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-subtle">
                Drop this entity&apos;s summary, bio, legal, and registration documents here — Cappo reads
                their text when drafting grants and briefings.
              </p>

              {docs.length === 0 && subfolders.length === 0 ? (
                <p className="rounded border border-dashed border-border px-3 py-4 text-center text-xs text-subtle">
                  No documents yet.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {subfolders.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 py-1.5 text-sm">
                      <Folder size={15} className="shrink-0 text-gold" />
                      <a href={f.webViewLink ?? "#"} target="_blank" rel="noreferrer" className="truncate text-fg hover:text-gold">
                        {f.name}
                      </a>
                    </li>
                  ))}
                  {docs.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 py-1.5 text-sm">
                      <FileText size={15} className="shrink-0 text-subtle" />
                      <a href={f.webViewLink ?? "#"} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-fg hover:text-gold">
                        {f.name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-1 flex items-center gap-2">
                <button
                  onClick={() => fileInput.current?.click()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-2.5 py-1.5 text-xs text-muted hover:text-fg disabled:opacity-50"
                >
                  <Upload size={13} /> Upload
                </button>
                <button
                  onClick={load}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-2.5 py-1.5 text-xs text-muted hover:text-fg disabled:opacity-50"
                >
                  <RefreshCw size={13} className={busy ? "animate-spin" : ""} /> Refresh
                </button>
                {data.folderUrl && (
                  <a
                    href={data.folderUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-2.5 py-1.5 text-xs text-muted hover:text-fg"
                  >
                    <ExternalLink size={13} /> Open in Drive
                  </a>
                )}
                <input ref={fileInput} type="file" hidden onChange={onUpload} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

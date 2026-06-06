"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  HardDrive,
  Folder,
  FileText,
  FolderPlus,
  FilePlus2,
  Upload,
  RefreshCw,
  Pencil,
  Trash2,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
}
interface Crumb {
  id: string;
  name: string;
}
interface DrivePayload {
  configured: boolean;
  connected: boolean;
  items: DriveItem[];
  breadcrumbs: Crumb[];
}

function fmtSize(size?: string) {
  if (!size) return "";
  const n = Number(size);
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}
function fmtDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DrivePage() {
  const [parent, setParent] = useState("root");
  const [data, setData] = useState<DrivePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Async load — only sets state after awaits (no synchronous set-state-in-effect).
  const load = useCallback(async (p: string) => {
    try {
      const r = await fetch(`/api/drive?parent=${encodeURIComponent(p)}`);
      setData(await r.json());
    } catch {
      setData({ configured: true, connected: false, items: [], breadcrumbs: [] });
    }
  }, []);

  useEffect(() => {
    // load() only updates state after an await (async) — safe despite the rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(parent);
  }, [parent, load]);

  const loading = data === null;

  async function mutate(fn: () => Promise<Response>) {
    setBusy(true);
    try {
      const res = await fn();
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(e.error || "Action failed");
      }
    } finally {
      setBusy(false);
      load(parent);
    }
  }

  const newFolder = () => {
    const name = prompt("New folder name");
    if (name?.trim())
      mutate(() =>
        fetch("/api/drive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "folder", name, parent }),
        }),
      );
  };
  const newDoc = () => {
    const name = prompt("New Google Doc name");
    if (name?.trim())
      mutate(() =>
        fetch("/api/drive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "doc", name, parent }),
        }),
      );
  };
  const rename = (it: DriveItem) => {
    const name = prompt("Rename", it.name);
    if (name?.trim() && name !== it.name)
      mutate(() =>
        fetch("/api/drive", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: it.id, name }),
        }),
      );
  };
  const del = (it: DriveItem) => {
    if (confirm(`Move "${it.name}" to Trash?`))
      mutate(() => fetch(`/api/drive?id=${it.id}`, { method: "DELETE" }));
  };
  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("parent", parent);
    mutate(() => fetch("/api/drive/upload", { method: "POST", body: fd }));
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-strong bg-panel text-gold">
          <HardDrive size={22} strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-fg">Drive</h1>
          <p className="text-sm text-subtle">Browse and manage the AMG Google Drive.</p>
        </div>
      </div>

      {loading && (
        <div className="panel p-8 text-center text-sm text-subtle">Loading Drive…</div>
      )}

      {!loading && data && !data.configured && (
        <div className="panel p-6 text-sm text-subtle">
          Google isn&apos;t configured.{" "}
          <Link href="/settings" className="text-gold hover:underline">
            Open Settings
          </Link>
        </div>
      )}

      {!loading && data && data.configured && !data.connected && (
        <div className="panel panel-gold flex flex-col items-center gap-3 p-10 text-center">
          <HardDrive size={40} className="text-gold" />
          <p className="text-sm text-muted">Connect Google Drive to browse and manage files here.</p>
          <a
            href="/api/connectors/google/authorize"
            className="rounded-lg btn-gold px-4 py-2 text-sm"
          >
            Connect Google Drive
          </a>
        </div>
      )}

      {data?.connected && (
        <div className="panel flex min-h-0 flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
            <nav className="flex min-w-0 flex-1 items-center gap-1 text-sm">
              {data.breadcrumbs.map((c, i) => (
                <span key={c.id} className="flex items-center gap-1 truncate">
                  {i > 0 && <ChevronRight size={13} className="shrink-0 text-subtle" />}
                  <button
                    onClick={() => setParent(c.id)}
                    className={`truncate rounded px-1.5 py-0.5 hover:bg-white/5 ${
                      i === data.breadcrumbs.length - 1 ? "text-fg" : "text-muted"
                    }`}
                  >
                    {c.name}
                  </button>
                </span>
              ))}
            </nav>
            <div className="flex items-center gap-1">
              <ToolbarBtn onClick={newFolder} disabled={busy} icon={<FolderPlus size={15} />} label="Folder" />
              <ToolbarBtn onClick={newDoc} disabled={busy} icon={<FilePlus2 size={15} />} label="Doc" />
              <ToolbarBtn onClick={() => fileInput.current?.click()} disabled={busy} icon={<Upload size={15} />} label="Upload" />
              <button
                onClick={() => load(parent)}
                disabled={busy}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle hover:bg-white/5 hover:text-fg"
                title="Refresh"
              >
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              </button>
              <input ref={fileInput} type="file" hidden onChange={onUpload} />
            </div>
          </div>

          {/* Listing */}
          {loading ? (
            <p className="p-8 text-center text-sm text-subtle">Loading…</p>
          ) : data.items.length === 0 ? (
            <p className="p-10 text-center text-sm text-subtle">This folder is empty.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.items.map((it) => (
                <li key={it.id} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03]">
                  {it.isFolder ? (
                    <Folder size={17} className="shrink-0 text-gold" />
                  ) : (
                    <FileText size={17} className="shrink-0 text-subtle" />
                  )}
                  {it.isFolder ? (
                    <button
                      onClick={() => setParent(it.id)}
                      className="min-w-0 flex-1 truncate text-left text-sm text-fg hover:text-gold"
                    >
                      {it.name}
                    </button>
                  ) : (
                    <a
                      href={it.webViewLink ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate text-sm text-fg hover:text-gold"
                    >
                      {it.name}
                    </a>
                  )}
                  <span className="hidden w-20 shrink-0 text-right text-xs text-subtle sm:block">
                    {fmtSize(it.size)}
                  </span>
                  <span className="hidden w-28 shrink-0 text-right text-xs text-subtle md:block">
                    {fmtDate(it.modifiedTime)}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {it.webViewLink && (
                      <a
                        href={it.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-7 w-7 items-center justify-center rounded text-subtle hover:bg-white/5 hover:text-fg"
                        title="Open in Drive"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                    <button
                      onClick={() => rename(it)}
                      className="flex h-7 w-7 items-center justify-center rounded text-subtle hover:bg-white/5 hover:text-fg"
                      title="Rename"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => del(it)}
                      className="flex h-7 w-7 items-center justify-center rounded text-subtle hover:bg-white/5 hover:text-neg"
                      title="Move to Trash"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({
  onClick,
  disabled,
  icon,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-2.5 py-1.5 text-xs text-muted hover:text-fg disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}

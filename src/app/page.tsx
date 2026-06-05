import { getAllStatuses, getUnifiedFeed } from "@/lib/connectors";
import { env } from "@/lib/env";
import type { ConnectorStatus, UnifiedItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<UnifiedItem["kind"], string> = {
  task: "Task",
  doc: "Doc",
  file: "File",
  message: "Email",
};

function StatusBadge({ s }: { s: ConnectorStatus }) {
  const [color, label] = s.connected
    ? ["bg-green-500", "Connected"]
    : s.configured
      ? ["bg-amber-500", "Action needed"]
      : ["bg-gray-400", "Not configured"];
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function ConnectorCard({ s }: { s: ConnectorStatus }) {
  const isGoogle = s.id === "drive" || s.id === "gmail";
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/15 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{s.name}</h3>
        <StatusBadge s={s} />
      </div>
      <p className="text-sm text-black/60 dark:text-white/60 min-h-[2.5rem]">
        {s.error ?? s.detail ?? "—"}
      </p>
      {isGoogle && s.configured && !s.connected && (
        <a
          href="/api/auth/google"
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          Connect Google →
        </a>
      )}
    </div>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const { google } = await searchParams;
  const [statuses, feed] = await Promise.all([getAllStatuses(), getUnifiedFeed()]);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12 flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Cappo Meridian</h1>
        <p className="text-black/60 dark:text-white/60">
          Project management hub for{" "}
          <span className="font-medium">{env.GOOGLE_WORKSPACE_DOMAIN}</span> — unifying
          ClickUp, Notion, Google Drive &amp; Gmail.
        </p>
      </header>

      {google === "connected" && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm">
          ✓ Google account connected.
        </div>
      )}
      {google && google !== "connected" && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm">
          Google authorization failed ({google}). Try again.
        </div>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Connectors</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statuses.map((s) => (
            <ConnectorCard key={s.id} s={s} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Recent activity</h2>
        {feed.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            No items yet. Configure connectors in <code>.env.local</code> and connect Google
            to populate the unified feed.
          </p>
        ) : (
          <ul className="divide-y divide-black/10 dark:divide-white/10 rounded-xl border border-black/10 dark:border-white/15">
            {feed.map((item) => (
              <li
                key={`${item.source}-${item.id}`}
                className="px-4 py-3 flex items-center gap-3"
              >
                <span className="text-[10px] uppercase tracking-wide rounded bg-black/5 dark:bg-white/10 px-2 py-1 w-14 text-center">
                  {KIND_LABEL[item.kind]}
                </span>
                <a
                  href={item.url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 truncate text-sm hover:underline"
                >
                  {item.title}
                </a>
                <span className="text-xs text-black/40 dark:text-white/40 shrink-0">
                  {item.source}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

import { Mail, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card, SectionTitle } from "@/components/ui/Card";
import { getUnifiedFeed } from "@/lib/connectors";
import type { UnifiedItem } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Clean sender label from a raw From header ("Name <addr>" → "Name"; else the address). */
function senderLabel(from: string | undefined): string {
  if (!from) return "Unknown sender";
  const name = from.includes("<") ? from.split("<")[0].trim().replace(/^"|"$/g, "") : from.trim();
  return name || from.replace(/[<>]/g, "").trim() || "Unknown sender";
}

export default async function MessagesPage() {
  const feed = await getUnifiedFeed();
  const messages = feed.filter((i) => i.kind === "message");

  // Group by sender, most-frequent sender first.
  const groups = new Map<string, UnifiedItem[]>();
  for (const m of messages) {
    const key = senderLabel(m.meta?.from as string | undefined);
    const bucket = groups.get(key);
    if (bucket) bucket.push(m);
    else groups.set(key, [m]);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-strong bg-panel text-gold">
          <Mail size={22} strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-fg">Messages</h1>
          <p className="text-sm text-subtle">Unified email and team messages — grouped by sender.</p>
        </div>
      </div>

      <Card className="p-5">
        <SectionTitle
          title="Inbox"
          action={
            <span className="text-xs text-subtle">
              {messages.length} recent · {sorted.length} senders
            </span>
          }
        />
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted">Connect Gmail to surface your inbox here.</p>
            <Link
              href="/settings"
              className="rounded-lg border border-border-strong px-3 py-1.5 text-sm text-gold hover:bg-gold/10"
            >
              Connect Gmail
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sorted.map(([sender, msgs], idx) => (
              <details
                key={sender}
                open={idx < 3}
                className="group rounded-lg border border-border bg-bg/40 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-fg hover:text-gold">
                  <ChevronRight
                    size={15}
                    className="shrink-0 text-subtle transition-transform group-open:rotate-90"
                  />
                  <span className="truncate">{sender}</span>
                  <span className="ml-auto shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-xs text-gold">
                    {msgs.length}
                  </span>
                </summary>
                <ul className="flex flex-col divide-y divide-border border-t border-border">
                  {msgs.map((m) => (
                    <li key={m.id} className="flex flex-col gap-0.5 px-3 py-3 pl-9">
                      <a
                        href={m.url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-sm font-medium text-fg hover:text-gold"
                      >
                        {m.title}
                      </a>
                      {typeof m.meta?.snippet === "string" && (
                        <p className="truncate text-xs text-subtle">{m.meta.snippet}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

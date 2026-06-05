import { Mail } from "lucide-react";
import Link from "next/link";
import { Card, SectionTitle } from "@/components/ui/Card";
import { getUnifiedFeed } from "@/lib/connectors";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const feed = await getUnifiedFeed();
  const messages = feed.filter((i) => i.kind === "message");

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-strong bg-panel text-gold">
          <Mail size={22} strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-fg">Messages</h1>
          <p className="text-sm text-subtle">Unified email and team messages.</p>
        </div>
      </div>

      <Card className="p-5">
        <SectionTitle
          title="Inbox"
          action={<span className="text-xs text-subtle">{messages.length} recent</span>}
        />
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted">
              Connect Gmail to surface your inbox here.
            </p>
            <Link
              href="/settings"
              className="rounded-lg border border-border-strong px-3 py-1.5 text-sm text-gold hover:bg-gold/10"
            >
              Connect Gmail
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {messages.map((m) => (
              <li key={m.id} className="flex flex-col gap-0.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <a
                    href={m.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-sm font-medium text-fg hover:text-gold"
                  >
                    {m.title}
                  </a>
                  <span className="shrink-0 text-xs text-subtle">
                    {m.meta?.from as string | undefined}
                  </span>
                </div>
                {typeof m.meta?.snippet === "string" && (
                  <p className="truncate text-xs text-subtle">{m.meta.snippet}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

import Link from "next/link";
import { ChevronRight, Quote } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { listDigests, listInitiatives, listMentions, type Initiative, type InitiativeMention } from "@/lib/db";
import { isDbConfigured } from "@/lib/env";
import { MeetingActions } from "./MeetingActions";

export const dynamic = "force-dynamic";

const HORIZON_LABEL: Record<string, string> = {
  current: "Current initiatives",
  future: "On the horizon",
};

function fmt(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** One initiative, expandable to the meetings and quotes that produced it. */
function InitiativeRow({ i, mentions }: { i: Initiative; mentions: InitiativeMention[] }) {
  return (
    <details className="group rounded-lg border border-border bg-bg/40 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2.5 hover:text-gold">
        <ChevronRight
          size={15}
          className="mt-0.5 shrink-0 text-subtle transition-transform group-open:rotate-90"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-fg">{i.title}</span>
            {i.status !== "active" && (
              <span className="shrink-0 rounded-full bg-border px-2 py-0.5 text-[11px] text-subtle">
                {i.status}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">{i.summary}</span>
        </span>
        <span className="shrink-0 text-right text-[11px] leading-tight text-subtle">
          {i.owner && <span className="block text-fg/70">{i.owner}</span>}
          {fmt(i.last_seen_at)}
          <span className="mt-0.5 block rounded-full bg-gold/15 px-2 py-0.5 text-gold">
            {mentions.length} {mentions.length === 1 ? "mention" : "mentions"}
          </span>
        </span>
      </summary>
      <ul className="flex flex-col divide-y divide-border border-t border-border">
        {mentions.length === 0 && (
          <li className="px-3 py-3 pl-9 text-xs text-subtle">No recorded mentions.</li>
        )}
        {mentions.map((m) => (
          <li key={m.id} className="px-3 py-3 pl-9">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-medium text-fg">{m.meeting_title}</span>
              <span className="text-[11px] text-subtle">{m.occurred_at ? fmt(m.occurred_at) : ""}</span>
            </div>
            {m.change_note && <p className="mt-1 text-xs text-muted">{m.change_note}</p>}
            <p className="mt-1.5 flex gap-1.5 text-xs italic leading-relaxed text-subtle">
              <Quote size={11} className="mt-0.5 shrink-0" />
              <span>{m.excerpt}</span>
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default async function MeetingsPage() {
  if (!isDbConfigured()) {
    return (
      <div className="pt-2">
        <Card className="p-5">
          <SectionTitle title="Meeting Intelligence" />
          <p className="py-8 text-center text-sm text-subtle">
            Set DATABASE_URL to enable the initiative registry.
          </p>
        </Card>
      </div>
    );
  }

  const all = await listInitiatives(true);
  const active = all.filter((i) => i.status === "active");
  const closed = all.filter((i) => i.status !== "active");
  const digests = await listDigests(10);

  // Mentions for every initiative, fetched in parallel — the audit trail is the
  // point of the page, so it loads with it rather than behind a click.
  const mentionsById = new Map<string, InitiativeMention[]>(
    await Promise.all(
      all.map(async (i) => [i.id, await listMentions(i.id)] as [string, InitiativeMention[]]),
    ),
  );

  const groups: [string, Initiative[]][] = [
    ["current", active.filter((i) => i.horizon === "current")],
    ["future", active.filter((i) => i.horizon === "future")],
  ];

  return (
    <div className="flex flex-col gap-6 pt-2">
      <Card className="p-5">
        <SectionTitle
          title="Meeting Intelligence"
          action={
            <span className="flex items-center gap-3">
              <span className="text-xs text-subtle">
                {active.length} active · {closed.length} closed
              </span>
              <MeetingActions />
            </span>
          }
        />
        {all.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm text-muted">
              No initiatives yet. Sync to pull meeting transcripts from Gemini, Fathom, Notion,
              and ClickUp.
            </p>
            <Link href="/settings" className="text-sm text-gold hover:underline">
              Check the Google connector →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map(([horizon, items]) =>
              items.length === 0 ? null : (
                <div key={horizon} className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
                    {HORIZON_LABEL[horizon]}
                  </h3>
                  {items.map((i) => (
                    <InitiativeRow key={i.id} i={i} mentions={mentionsById.get(i.id) ?? []} />
                  ))}
                </div>
              ),
            )}
            {closed.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Closed</h3>
                {closed.map((i) => (
                  <InitiativeRow key={i.id} i={i} mentions={mentionsById.get(i.id) ?? []} />
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <SectionTitle title="Digest history" />
        {digests.length === 0 ? (
          <p className="py-6 text-center text-sm text-subtle">No digests sent yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {digests.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-24 shrink-0 text-xs text-subtle">{d.sent_for}</span>
                <span className="min-w-0 flex-1 truncate text-fg">{d.subject}</span>
                <span className="shrink-0 text-xs text-subtle">{d.recipients}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                    d.sent_at ? "bg-gold/15 text-gold" : "bg-border text-subtle"
                  }`}
                >
                  {d.sent_at ? "sent" : "pending"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

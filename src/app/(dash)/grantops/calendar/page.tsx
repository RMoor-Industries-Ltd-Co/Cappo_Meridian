import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { fundingCalendar } from "@/lib/grantops/store";
import { RecommendationBadge, money } from "@/components/grantops/badges";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  const entries = fundingCalendar();
  const upcoming = entries.filter((e) => e.days >= 0);
  const past = entries.filter((e) => e.days < 0);

  const row = (e: (typeof entries)[number]) => (
    <li key={e.opportunity.id} className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <Link href={`/grantops/opportunities/${e.opportunity.id}`} className="block truncate text-sm font-medium text-fg hover:text-gold">
          {e.opportunity.opportunityName}
        </Link>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-subtle">
          <RecommendationBadge value={e.opportunity.recommendation} />
          {e.opportunity.bestApplicantEntity} · {money(e.opportunity.fundingAmount)}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-medium text-fg">{e.deadline}</div>
        <div className={`text-xs ${e.days < 0 ? "text-subtle" : e.days <= 14 ? "text-amber-400" : "text-subtle"}`}>
          {e.days < 0 ? `${Math.abs(e.days)}d ago` : e.days === 0 ? "today" : `in ${e.days}d`}
        </div>
      </div>
    </li>
  );

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-subtle">
        Dated deadlines only — rolling programs live in Opportunities. {upcoming.length} upcoming.
      </p>

      <Card className="p-5">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Upcoming</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-subtle">No dated deadlines ahead.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">{upcoming.map(row)}</ul>
        )}
      </Card>

      {past.length > 0 && (
        <Card className="p-5 opacity-70">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Passed</h3>
          <ul className="flex flex-col divide-y divide-border">{past.map(row)}</ul>
        </Card>
      )}
    </div>
  );
}

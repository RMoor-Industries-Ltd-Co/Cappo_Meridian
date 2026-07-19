import Link from "next/link";
import { Card, SectionTitle } from "@/components/ui/Card";
import { dashboardSummary, listOpportunities, daysUntil } from "@/lib/grantops/store";
import { riskFlags } from "@/lib/grantops/types";
import {
  CappoBadge,
  RecommendationBadge,
  RiskFlags,
  deadlineLabel,
  money,
} from "@/components/grantops/badges";

export const dynamic = "force-dynamic";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="flex flex-col gap-1.5 p-5">
      <span className="text-xs uppercase tracking-wide text-subtle">{label}</span>
      <span className="text-3xl font-semibold text-fg">{value}</span>
      {hint && <span className="text-xs text-subtle">{hint}</span>}
    </Card>
  );
}

export default function GrantOpsCommandPage() {
  const s = dashboardSummary();
  const all = listOpportunities();

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Opportunities" value={String(s.totalOpportunities)} hint="tracked across all entities" />
        <Stat label="Apply Now" value={String(s.applyNow)} hint="ALLIE-recommended" />
        <Stat label="Awaiting CAPPO" value={String(s.pendingCappoReview)} hint="in the governance queue" />
        <Stat label="Potential cash" value={money(s.potentialCashValue)} hint="non-dilutive cash/reimbursement" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle
            title="Closing soon (≤ 21 days)"
            action={<Link href="/grantops/calendar" className="text-xs text-gold hover:underline">Calendar →</Link>}
          />
          {s.closingSoon.length === 0 ? (
            <p className="text-sm text-subtle">No dated deadlines inside three weeks.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {s.closingSoon.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/grantops/opportunities/${o.id}`} className="block truncate text-sm text-fg hover:text-gold">
                      {o.opportunityName}
                    </Link>
                    <span className="text-xs text-subtle">
                      {o.bestApplicantEntity} · {money(o.fundingAmount)}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-amber-400">
                    {deadlineLabel(o.deadline, daysUntil(o.deadline))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle
            title="Top priorities"
            action={<Link href="/grantops/opportunities" className="text-xs text-gold hover:underline">All →</Link>}
          />
          <ul className="flex flex-col divide-y divide-border">
            {s.topPriorities.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link href={`/grantops/opportunities/${o.id}`} className="block truncate text-sm text-fg hover:text-gold">
                    {o.opportunityName}
                  </Link>
                  <div className="mt-1 flex items-center gap-1.5">
                    <RecommendationBadge value={o.recommendation} />
                    <span className="text-xs text-subtle">{o.bestApplicantEntity}</span>
                  </div>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold text-gold">
                  {o.finalPriorityScore.toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle title="Pipeline" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Verify First", value: s.verifyFirst },
            { label: "Watchlist", value: s.watchlist },
            { label: "Open apps", value: s.openApplications },
            { label: "Submitted", value: s.submitted },
            { label: "Apply Now", value: s.applyNow },
            { label: "Awaiting CAPPO", value: s.pendingCappoReview },
          ].map((x) => (
            <div key={x.label} className="rounded-lg border border-border bg-panel-2 p-3">
              <div className="text-2xl font-semibold text-fg">{x.value}</div>
              <div className="text-xs text-subtle">{x.label}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card gold className="p-5">
        <SectionTitle title="Governance watch — flagged opportunities" />
        <div className="flex flex-col gap-3">
          {all
            .map((o) => ({ o, flags: riskFlags(o).filter((f) => f.severity !== "verify") }))
            .filter((x) => x.flags.length > 0)
            .slice(0, 6)
            .map(({ o, flags }) => (
              <div key={o.id} className="flex flex-col gap-2 border-b border-border pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Link href={`/grantops/opportunities/${o.id}`} className="text-sm text-fg hover:text-gold">
                    {o.opportunityName}
                  </Link>
                  <CappoBadge value={o.cappoDecision} />
                </div>
                <RiskFlags flags={flags} />
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}

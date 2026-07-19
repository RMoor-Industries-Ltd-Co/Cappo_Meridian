import Link from "next/link";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { listOpportunities, daysUntil } from "@/lib/grantops/store";
import { riskFlags } from "@/lib/grantops/types";
import {
  CappoBadge,
  Pill,
  RecommendationBadge,
  deadlineLabel,
  money,
} from "@/components/grantops/badges";

export const dynamic = "force-dynamic";

export default function OpportunitiesPage() {
  const opps = listOpportunities();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-subtle">{opps.length} opportunities · ranked by final priority score</p>
        <Link
          href="/grantops/opportunities/new"
          className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 px-3 py-1.5 text-sm font-medium text-gold hover:bg-gold/10"
        >
          <Plus size={15} /> Add opportunity
        </Link>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle">
              <th className="px-4 py-3 font-medium">Opportunity</th>
              <th className="px-4 py-3 font-medium">Entity</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Deadline</th>
              <th className="px-4 py-3 font-medium">Recommendation</th>
              <th className="px-4 py-3 font-medium">CAPPO</th>
              <th className="px-4 py-3 text-right font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {opps.map((o) => {
              const blockers = riskFlags(o).filter((f) => f.severity === "block").length;
              return (
                <tr key={o.id} className="border-b border-border/60 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <Link href={`/grantops/opportunities/${o.id}`} className="font-medium text-fg hover:text-gold">
                      {o.opportunityName}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-subtle">
                      {o.fundingOrganization}
                      {blockers > 0 && <Pill tone="neg">{blockers} blocker{blockers > 1 ? "s" : ""}</Pill>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-subtle">{o.bestApplicantEntity}</td>
                  <td className="px-4 py-3 text-fg">{money(o.fundingAmount)}</td>
                  <td className="px-4 py-3 text-subtle">{deadlineLabel(o.deadline, daysUntil(o.deadline))}</td>
                  <td className="px-4 py-3"><RecommendationBadge value={o.recommendation} /></td>
                  <td className="px-4 py-3"><CappoBadge value={o.cappoDecision} /></td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gold">{o.finalPriorityScore.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

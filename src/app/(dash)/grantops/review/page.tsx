import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { reviewQueue, daysUntil } from "@/lib/grantops/store";
import { riskFlags } from "@/lib/grantops/types";
import { cappoDecisionAction } from "@/lib/grantops/actions";
import { RecommendationBadge, RiskFlags, deadlineLabel, money } from "@/components/grantops/badges";

export const dynamic = "force-dynamic";

const field = "w-full rounded-md border border-border bg-panel-2 px-3 py-2 text-sm text-fg focus:border-gold/50 focus:outline-none";

export default function ReviewQueuePage() {
  const queue = reviewQueue();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-subtle">
        {queue.length} opportunit{queue.length === 1 ? "y" : "ies"} awaiting CAPPO&rsquo;s governance decision.
        Approving routes work to one operating entity and still requires human sign-off before submission.
      </p>

      {queue.length === 0 ? (
        <Card className="p-8 text-center text-sm text-subtle">The review queue is clear.</Card>
      ) : (
        queue.map((o) => (
          <Card key={o.id} className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link href={`/grantops/opportunities/${o.id}`} className="text-base font-semibold text-fg hover:text-gold">
                  {o.opportunityName}
                </Link>
                <div className="mt-0.5 text-xs text-subtle">
                  {o.fundingOrganization} · {o.bestApplicantEntity} · {money(o.fundingAmount)} · {deadlineLabel(o.deadline, daysUntil(o.deadline))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <RecommendationBadge value={o.recommendation} />
                <span className="font-mono text-lg font-semibold text-gold">{o.finalPriorityScore.toFixed(1)}</span>
              </div>
            </div>

            <RiskFlags flags={riskFlags(o)} />
            {o.allieNotes && <p className="text-sm text-muted">{o.allieNotes}</p>}

            <form action={cappoDecisionAction} className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-end">
              <input type="hidden" name="id" value={o.id} />
              <div className="sm:w-48">
                <label className="mb-1 block text-xs uppercase tracking-wide text-subtle">Decision</label>
                <select name="decision" defaultValue="pending" className={field}>
                  <option value="pending">Pending</option>
                  <option value="approved_to_apply">Approve to apply</option>
                  <option value="more_info_needed">Need more info</option>
                  <option value="deferred">Defer</option>
                  <option value="rejected">Reject</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs uppercase tracking-wide text-subtle">Notes</label>
                <input name="cappoNotes" className={field} placeholder="Governance rationale…" />
              </div>
              <button className="btn-gold rounded-md px-4 py-2 text-sm font-semibold">Record</button>
            </form>
          </Card>
        ))
      )}
    </div>
  );
}

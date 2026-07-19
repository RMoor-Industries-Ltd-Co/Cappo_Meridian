import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { listApplications, getOpportunity } from "@/lib/grantops/store";
import { Pill } from "@/components/grantops/badges";

export const dynamic = "force-dynamic";

export default function ApplicationsPage() {
  const apps = listApplications();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-subtle">
        {apps.length} application workspace{apps.length === 1 ? "" : "s"}. Each is a prep space —
        checklist, drafts, and a human-approval gate. Submission is recorded here only after a human does it.
      </p>

      {apps.length === 0 ? (
        <Card className="p-8 text-center text-sm text-subtle">
          No workspaces yet. Open one from an opportunity&rsquo;s detail page.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {apps.map((a) => {
            const o = getOpportunity(a.fundingOpportunityId);
            const done = a.applicationChecklist.filter((c) => c.done).length;
            return (
              <Card key={a.id} className="flex flex-col gap-2 p-5">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/grantops/applications/${a.id}`} className="font-semibold text-fg hover:text-gold">
                    {o?.opportunityName ?? a.fundingOpportunityId}
                  </Link>
                  <Pill tone="info">{a.applicationStatus.replace(/_/g, " ")}</Pill>
                </div>
                <div className="text-xs text-subtle">
                  {a.applicantEntity} · checklist {done}/{a.applicationChecklist.length}
                </div>
                <div className="flex items-center gap-2">
                  {a.humanApprovalRequired ? <Pill tone="warn">Approval required</Pill> : <Pill tone="pos">Approved</Pill>}
                  {a.confirmationNumber && <Pill tone="pos">Submitted · {a.confirmationNumber}</Pill>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

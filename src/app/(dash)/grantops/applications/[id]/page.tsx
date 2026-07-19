import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, SectionTitle } from "@/components/ui/Card";
import { getApplication, getOpportunity } from "@/lib/grantops/store";
import {
  approveApplicationAction,
  recordSubmissionAction,
  toggleChecklistAction,
  updateApplicationAction,
} from "@/lib/grantops/actions";
import { Pill, money } from "@/components/grantops/badges";

export const dynamic = "force-dynamic";

const field = "w-full rounded-md border border-border bg-panel-2 px-3 py-2 text-sm text-fg focus:border-gold/50 focus:outline-none";
const labelCls = "mb-1 block text-xs uppercase tracking-wide text-subtle";

const APP_STATUSES = [
  "workspace_created", "documents_gathering", "narrative_drafting", "budget_drafting",
  "founder_review", "final_assembly", "ready_to_submit", "submitted", "follow_up",
  "awarded", "denied", "compliance",
];

const DRAFT_FIELDS: [string, string][] = [
  ["businessSummaryDraft", "Business summary"],
  ["narrativeDraft", "Project narrative"],
  ["useOfFundsDraft", "Use of funds"],
  ["budgetNarrativeDraft", "Budget narrative"],
  ["impactStatementDraft", "Impact statement"],
  ["founderBioDraft", "Founder bio"],
];

export default async function ApplicationWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = getApplication(id);
  if (!a) notFound();
  const o = getOpportunity(a.fundingOpportunityId);
  const done = a.applicationChecklist.filter((c) => c.done).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link href="/grantops/applications" className="text-xs text-subtle hover:text-fg">← All applications</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-fg">{o?.opportunityName ?? a.fundingOpportunityId}</h2>
          <Pill tone="info">{a.applicationStatus.replace(/_/g, " ")}</Pill>
          {a.humanApprovalRequired ? <Pill tone="warn">Human approval required</Pill> : <Pill tone="pos">Approved by {a.approvedBy}</Pill>}
        </div>
        {o && (
          <p className="text-sm text-subtle">
            {a.applicantEntity} applies · {money(o.fundingAmount)} · {o.fundingOrganization}
            {" · "}
            <Link href={`/grantops/opportunities/${o.id}`} className="text-gold hover:underline">opportunity</Link>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Checklist */}
        <Card className="p-5">
          <SectionTitle title={`Document checklist · ${done}/${a.applicationChecklist.length}`} />
          {a.applicationChecklist.length === 0 ? (
            <p className="text-sm text-subtle">No required documents recorded on the opportunity.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {a.applicationChecklist.map((c) => (
                <li key={c.documentType}>
                  <form action={toggleChecklistAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="documentType" value={c.documentType} />
                    <input
                      type="checkbox"
                      name="done"
                      defaultChecked={c.done}
                      className="accent-[var(--gold)]"
                    />
                    <button className="text-left text-sm text-fg hover:text-gold">
                      {c.label}
                    </button>
                    {c.done && <Pill tone="pos">ready</Pill>}
                  </form>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-subtle">Toggle a box and press its label to save.</p>
        </Card>

        {/* Status + Drive + approval + submission */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <SectionTitle title="Workspace status" />
            <form action={updateApplicationAction} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={a.id} />
              <div>
                <label className={labelCls}>Status</label>
                <select name="applicationStatus" defaultValue={a.applicationStatus} className={field}>
                  {APP_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Drive folder URL</label>
                <input name="driveFolderUrl" type="url" defaultValue={a.driveFolderUrl ?? ""} className={field} placeholder="https://drive.google.com/…" />
              </div>
              <button className="btn-gold self-start rounded-md px-4 py-2 text-sm font-semibold">Save status</button>
            </form>
          </Card>

          <Card gold className="p-5">
            <SectionTitle title="Human approval & submission" />
            <p className="mb-3 text-xs text-subtle">
              GrantOps never submits to a third-party portal. A human approves, submits off-platform,
              then records the confirmation number here.
            </p>
            {a.humanApprovalRequired ? (
              <form action={approveApplicationAction} className="flex items-end gap-2">
                <input type="hidden" name="id" value={a.id} />
                <div className="flex-1">
                  <label className={labelCls}>Approve as</label>
                  <select name="approvedBy" defaultValue="Rahmel" className={field}>
                    <option value="Rahmel">Rahmel</option>
                    <option value="Haneef">Haneef</option>
                    <option value="Both">Both</option>
                  </select>
                </div>
                <button className="rounded-md border border-gold/50 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10">Approve to submit</button>
              </form>
            ) : (
              <form action={recordSubmissionAction} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={a.id} />
                <Pill tone="pos">Approved by {a.approvedBy} — cleared for human submission</Pill>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Submitted by</label>
                    <select name="submittedBy" defaultValue={a.approvedBy ?? "Rahmel"} className={field}>
                      <option value="Rahmel">Rahmel</option>
                      <option value="Haneef">Haneef</option>
                      <option value="Both">Both</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Confirmation #</label>
                    <input name="confirmationNumber" className={field} placeholder="portal ref…" required />
                  </div>
                </div>
                {a.confirmationNumber ? (
                  <Pill tone="pos">Submitted {a.submittedDate?.slice(0, 10)} · {a.confirmationNumber}</Pill>
                ) : (
                  <button className="btn-gold self-start rounded-md px-4 py-2 text-sm font-semibold">Record submission</button>
                )}
              </form>
            )}
          </Card>
        </div>
      </div>

      {/* Drafts */}
      <Card className="p-5">
        <SectionTitle title="Application drafts (for founder review — never auto-submitted)" />
        <form action={updateApplicationAction} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <input type="hidden" name="id" value={a.id} />
          {DRAFT_FIELDS.map(([name, label]) => (
            <div key={name}>
              <label className={labelCls}>{label}</label>
              <textarea
                name={name}
                rows={4}
                defaultValue={(a as unknown as Record<string, string>)[name] ?? ""}
                className={field}
              />
            </div>
          ))}
          <div className="lg:col-span-2">
            <label className={labelCls}>Risk notes</label>
            <textarea name="riskNotes" rows={2} defaultValue={a.riskNotes ?? ""} className={field} />
          </div>
          <div className="lg:col-span-2">
            <button className="btn-gold rounded-md px-4 py-2 text-sm font-semibold">Save drafts</button>
          </div>
        </form>
      </Card>
    </div>
  );
}

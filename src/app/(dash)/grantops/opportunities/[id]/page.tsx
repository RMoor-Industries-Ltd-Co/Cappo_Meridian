import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FolderOpen } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import {
  getOpportunity,
  getApplicationForOpportunity,
  daysUntil,
} from "@/lib/grantops/store";
import { riskFlags, type FundingOpportunity } from "@/lib/grantops/types";
import {
  cappoDecisionAction,
  updateOpportunityScoresAction,
} from "@/lib/grantops/actions";
import {
  CappoBadge,
  Pill,
  RecommendationBadge,
  RiskFlags,
  TriStatePill,
  deadlineLabel,
  money,
} from "@/components/grantops/badges";

export const dynamic = "force-dynamic";

const field = "w-full rounded-md border border-border bg-panel-2 px-3 py-2 text-sm text-fg focus:border-gold/50 focus:outline-none";
const labelCls = "mb-1 block text-xs uppercase tracking-wide text-subtle";

const ELIGIBILITY: [keyof FundingOpportunity, string][] = [
  ["blackMaleFounderEligible", "Black-male-founder eligible"],
  ["blackOwnedEligible", "Black-owned eligible"],
  ["minorityOwnedEligible", "Minority-owned eligible"],
  ["forProfitEligible", "For-profit eligible"],
  ["georgiaEligible", "Georgia eligible"],
  ["atlantaEligible", "Atlanta eligible"],
  ["nonprofitRequired", "Nonprofit required"],
  ["womanOwnedRequired", "Woman-owned required"],
  ["veteranStatusRequired", "Veteran required"],
  ["physicalStorefrontRequired", "Storefront required"],
  ["revenueHistoryRequired", "Revenue history required"],
  ["matchRequired", "Match / cost-share"],
  ["samGovRequired", "SAM.gov / UEI"],
  ["mbeCertificationRequired", "MBE certification"],
];

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = getOpportunity(id);
  if (!o) notFound();
  const flags = riskFlags(o);
  const app = getApplicationForOpportunity(id);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link href="/grantops/opportunities" className="text-xs text-subtle hover:text-fg">← All opportunities</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-fg">{o.opportunityName}</h2>
          <RecommendationBadge value={o.recommendation} />
          <CappoBadge value={o.cappoDecision} />
          <span className="font-mono text-lg font-semibold text-gold">{o.finalPriorityScore.toFixed(1)}</span>
        </div>
        <p className="text-sm text-subtle">{o.fundingOrganization}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4"><div className="text-xs text-subtle">Amount</div><div className="text-lg font-semibold text-fg">{money(o.fundingAmount)}</div></Card>
        <Card className="p-4"><div className="text-xs text-subtle">Deadline</div><div className="text-lg font-semibold text-fg">{deadlineLabel(o.deadline, daysUntil(o.deadline))}</div></Card>
        <Card className="p-4"><div className="text-xs text-subtle">Best applicant</div><div className="text-lg font-semibold text-fg">{o.bestApplicantEntity}</div></Card>
        <Card className="p-4"><div className="text-xs text-subtle">Award type</div><div className="text-lg font-semibold text-fg capitalize">{o.awardType.replace(/_/g, " ")}</div></Card>
      </div>

      <Card gold className="p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle title="Cappo's fit briefing" />
          <Link href={`/grantops/opportunities/${o.id}/briefing`} className="text-sm font-semibold text-gold hover:underline">
            {o.fitBriefing ? "Read full briefing →" : "Open pre-application briefing →"}
          </Link>
        </div>
        {o.fitBriefing ? (
          <>
            <p className="whitespace-pre-wrap text-sm text-fg">
              {o.fitBriefing.length > 480 ? `${o.fitBriefing.slice(0, 480).trimEnd()}…` : o.fitBriefing}
            </p>
            <p className="mt-2 text-[11px] text-subtle">
              Grounded in {o.bestApplicantEntity}&rsquo;s Drive knowledge base
              {o.fitBriefingAt ? ` · ${o.fitBriefingAt.slice(0, 10)}` : ""}
            </p>
          </>
        ) : (
          <p className="text-sm text-subtle">
            A read-first briefing of why this fits {o.bestApplicantEntity} — the fit assessment, requirements,
            and risks, grounded in the entity&rsquo;s Drive documents. Read it before starting the application.
          </p>
        )}
      </Card>

      <Card className="p-5">
        <SectionTitle title="Risk & governance flags" />
        <RiskFlags flags={flags} />
        <p className="mt-3 text-xs text-subtle">
          Flags preserve caution — a &ldquo;verify&rdquo; is never auto-resolved to eligible. Loans are
          marked as loans, tax credits as credits, accelerators as potentially dilutive until zero-equity is confirmed.
        </p>
      </Card>

      <Card className="p-5">
        <SectionTitle title="Eligibility (verify flags preserved)" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ELIGIBILITY.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-2 rounded-md border border-border bg-panel-2 px-3 py-2">
              <span className="text-xs text-muted">{label}</span>
              <TriStatePill value={o[key] as string} />
            </div>
          ))}
        </div>
      </Card>

      {(o.applicationUrl || o.sourceUrl) && (
        <div className="flex flex-wrap gap-3">
          {o.applicationUrl && (
            <a href={o.applicationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-gold hover:underline">
              <ExternalLink size={14} /> Application portal
            </a>
          )}
          {o.sourceUrl && (
            <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-subtle hover:text-fg">
              <ExternalLink size={14} /> Source
            </a>
          )}
        </div>
      )}

      {o.allieNotes && (
        <Card className="p-5">
          <SectionTitle title="ALLIE research notes" />
          <p className="whitespace-pre-wrap text-sm text-fg">{o.allieNotes}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Scoring editor */}
        <Card className="p-5">
          <SectionTitle title="Score & recommendation (ALLIE)" />
          <form action={updateOpportunityScoresAction} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={o.id} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ["strategicFitScore", "Fit", o.strategicFitScore],
                ["urgencyScore", "Urgency", o.urgencyScore],
                ["fundingValueScore", "Value", o.fundingValueScore],
                ["probabilityScore", "Prob.", o.probabilityScore],
                ["complexityDrag", "Drag", o.complexityDrag],
              ].map(([name, label, val]) => (
                <div key={name as string}>
                  <label className={labelCls}>{label as string}</label>
                  <input name={name as string} type="number" min="0" max="10" defaultValue={val as number} className={field} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Recommendation</label>
                <select name="recommendation" defaultValue={o.recommendation} className={field}>
                  <option value="apply_now">Apply Now</option>
                  <option value="verify_first">Verify First</option>
                  <option value="watchlist">Watchlist</option>
                  <option value="reject">Reject</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Human owner</label>
                <select name="humanOwner" defaultValue={o.humanOwner} className={field}>
                  <option value="Unassigned">Unassigned</option>
                  <option value="Rahmel">Rahmel</option>
                  <option value="Haneef">Haneef</option>
                  <option value="Both">Both</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>ALLIE notes</label>
              <textarea name="allieNotes" rows={2} defaultValue={o.allieNotes} className={field} />
            </div>
            <button className="btn-gold self-start rounded-md px-4 py-2 text-sm font-semibold">Save scoring</button>
          </form>
        </Card>

        {/* CAPPO decision */}
        <Card gold className="p-5">
          <SectionTitle title="CAPPO governance decision" />
          <p className="mb-3 text-xs text-subtle">
            The Executive Director&rsquo;s call. Approving to apply routes the work to one operating entity —
            never AMG directly — and still requires human sign-off before any submission.
          </p>
          <form action={cappoDecisionAction} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={o.id} />
            <div>
              <label className={labelCls}>Decision</label>
              <select name="decision" defaultValue={o.cappoDecision} className={field}>
                <option value="pending">Pending</option>
                <option value="approved_to_apply">Approve to apply</option>
                <option value="more_info_needed">Need more info</option>
                <option value="deferred">Defer</option>
                <option value="rejected">Reject</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>CAPPO notes</label>
              <textarea name="cappoNotes" rows={3} defaultValue={o.cappoNotes} className={field} placeholder="Governance rationale…" />
            </div>
            <button className="rounded-md border border-gold/50 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10">Record decision</button>
          </form>
        </Card>
      </div>

      {/* Application workspace */}
      <Card className="p-5">
        <SectionTitle title="Application workspace" />
        {app ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Pill tone="info">{app.applicationStatus.replace(/_/g, " ")}</Pill>
              {app.humanApprovalRequired ? <Pill tone="warn">Human approval required</Pill> : <Pill tone="pos">Approved by {app.approvedBy}</Pill>}
            </div>
            <div className="flex items-center gap-3">
              {app.driveFolderUrl && (
                <a href={app.driveFolderUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-gold hover:underline">
                  <FolderOpen size={14} /> Drive
                </a>
              )}
              <Link href={`/grantops/applications/${app.id}`} className="text-sm text-gold hover:underline">Open workspace →</Link>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-subtle">
              Read the pre-application briefing first — the fit, requirements, and risks — then agree
              to open a prep workspace. No external submission happens here.
            </p>
            <Link
              href={`/grantops/opportunities/${o.id}/briefing`}
              className="btn-gold shrink-0 rounded-md px-4 py-2 text-sm font-semibold"
            >
              Read briefing →
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}

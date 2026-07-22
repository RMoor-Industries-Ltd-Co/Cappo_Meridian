import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Sparkles } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import {
  DOCUMENT_LABELS,
  daysUntil,
  getApplicationForOpportunity,
  getEntityByCode,
  getOpportunity,
} from "@/lib/grantops/store";
import { riskFlags, type FundingOpportunity } from "@/lib/grantops/types";
import { buildFitAssessment } from "@/lib/grantops/briefing";
import { generateFitBriefingAction } from "@/lib/grantops/actions";
import { isAiConfigured } from "@/lib/env";
import { BriefingGate } from "@/components/grantops/BriefingGate";
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

export default async function OpportunityBriefingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const o = getOpportunity(id);
  if (!o) notFound();
  const entity = getEntityByCode(o.bestApplicantEntity);
  const app = getApplicationForOpportunity(id);
  const fit = buildFitAssessment(o, entity);
  const flags = riskFlags(o);
  const aiOn = isAiConfigured();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link href={`/grantops/opportunities/${o.id}`} className="text-xs text-subtle hover:text-fg">
          ← Back to opportunity
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-fg">{o.opportunityName}</h2>
          <RecommendationBadge value={o.recommendation} />
          <CappoBadge value={o.cappoDecision} />
        </div>
        <p className="text-sm text-subtle">
          {o.fundingOrganization} · applicant {entity?.entityName ?? o.bestApplicantEntity}
        </p>
        <p className="text-xs text-subtle">
          A read-first briefing. Review the fit, requirements, and risks below — then agree at the
          bottom to open the application workspace.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4"><div className="text-xs text-subtle">Amount</div><div className="text-lg font-semibold text-fg">{money(o.fundingAmount)}</div></Card>
        <Card className="p-4"><div className="text-xs text-subtle">Deadline</div><div className="text-lg font-semibold text-fg">{deadlineLabel(o.deadline, daysUntil(o.deadline))}</div></Card>
        <Card className="p-4"><div className="text-xs text-subtle">Applicant</div><div className="text-lg font-semibold text-fg">{o.bestApplicantEntity}</div></Card>
        <Card className="p-4"><div className="text-xs text-subtle">Priority</div><div className="text-lg font-semibold text-gold">{o.finalPriorityScore.toFixed(1)}</div></Card>
      </div>

      {/* Why this fits — deterministic assessment */}
      <Card gold className="p-5">
        <SectionTitle title={fit.headline} />
        <div className="flex flex-col gap-3">
          {fit.points.map((p, i) => (
            <div key={i} className="flex flex-col gap-1 rounded-md border border-border bg-panel-2 p-3">
              <div className="flex items-center gap-2">
                <Pill tone={p.tone}>{p.label}</Pill>
              </div>
              <p className="text-sm text-fg">{p.detail}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Cappo/ALLIE written brief */}
      <Card className="p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle title="Cappo &amp; ALLIE — written brief" />
          {aiOn && (
            <form action={generateFitBriefingAction}>
              <input type="hidden" name="id" value={o.id} />
              <button className="inline-flex items-center gap-1.5 rounded-md border border-gold/50 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/10">
                <Sparkles size={13} /> {o.fitBriefing ? "Regenerate" : "Generate"} brief
              </button>
            </form>
          )}
        </div>
        {o.fitBriefing ? (
          <>
            <p className="whitespace-pre-wrap text-sm text-fg">{o.fitBriefing}</p>
            {o.fitBriefingAt && (
              <p className="mt-2 text-[11px] text-subtle">Generated {o.fitBriefingAt.slice(0, 10)} · copy/paste editable</p>
            )}
          </>
        ) : (
          <p className="text-sm text-subtle">
            {aiOn
              ? "No written brief yet — generate one for a fuller, narrative read of why this fits."
              : "Connect an AI provider (Settings → Integrations) to have Cappo write a fuller narrative brief. The assessment above is always available."}
          </p>
        )}
        {(o.allieNotes || o.cappoNotes) && (
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
            {o.allieNotes && (
              <div>
                <div className="mb-1 text-xs uppercase tracking-wide text-subtle">ALLIE research notes</div>
                <p className="whitespace-pre-wrap text-sm text-fg">{o.allieNotes}</p>
              </div>
            )}
            {o.cappoNotes && (
              <div>
                <div className="mb-1 text-xs uppercase tracking-wide text-subtle">CAPPO governance notes</div>
                <p className="whitespace-pre-wrap text-sm text-fg">{o.cappoNotes}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Requirements */}
      <Card className="p-5">
        <SectionTitle title="What this application requires" />
        {o.requiredDocuments.length ? (
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {o.requiredDocuments.map((d) => (
              <li key={d} className="rounded-md border border-border bg-panel-2 px-3 py-2 text-sm text-fg">
                {DOCUMENT_LABELS[d] ?? d}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-subtle">No required documents recorded on this opportunity yet.</p>
        )}
      </Card>

      {/* Risk & eligibility */}
      <Card className="p-5">
        <SectionTitle title="Risk & governance flags" />
        <RiskFlags flags={flags} />
      </Card>
      <Card className="p-5">
        <SectionTitle title="Eligibility (verify flags preserved)" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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

      {/* Agree gate */}
      <Card gold className="p-5">
        <SectionTitle title="Ready to begin?" />
        {app ? (
          <div className="flex items-center justify-between gap-3">
            <Pill tone="info">Workspace already open · {app.applicationStatus.replace(/_/g, " ")}</Pill>
            <Link href={`/grantops/applications/${app.id}`} className="text-sm text-gold hover:underline">
              Open workspace →
            </Link>
          </div>
        ) : (
          <BriefingGate opportunityId={o.id} />
        )}
      </Card>
    </div>
  );
}

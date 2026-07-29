import Link from "next/link";
import { Check, Circle, ExternalLink } from "lucide-react";
import type { FundingOpportunity, GrantApplication } from "@/lib/grantops/types";

interface Step {
  title: string;
  done: boolean;
  hint?: string;
  href?: string;
  hrefLabel?: string;
  external?: boolean;
}

/**
 * The numbered application process — a single, always-visible flow so a founder knows
 * exactly where they are and what's next. Steps derive from the opportunity + application
 * state; each links to the surface where that step happens (no hidden dead-ends).
 */
export function ProcessStepper({ opp, app }: { opp: FundingOpportunity; app?: GrantApplication }) {
  const pages = app?.applicationPages ?? [];
  const approved = opp.cappoDecision === "approved_to_apply";
  const docsReady = Boolean(app && app.applicationChecklist.length > 0 && app.applicationChecklist.every((c) => c.done));
  const anyAnswers = pages.some((p) => p.questions.length > 0);
  const allApproved = pages.length > 0 && pages.every((p) => p.questions.every((q) => q.approved));
  const humanApproved = app ? !app.humanApprovalRequired : false;
  const submitted = Boolean(app?.confirmationNumber);
  const appHref = app ? `/grantops/applications/${app.id}` : undefined;

  const steps: Step[] = [
    { title: "Read the fit briefing", done: Boolean(opp.fitBriefing), href: `/grantops/opportunities/${opp.id}/briefing`, hrefLabel: "Open briefing" },
    { title: "CAPPO approves to apply", done: approved, hint: approved ? undefined : "Record the decision on the opportunity" },
  ];
  if (opp.externalAccountRequired) {
    steps.push({
      title: `Create an account on ${opp.fundingOrganization}`,
      done: false,
      hint: "Required before you can start — do this on the funder's site",
      href: opp.applicationUrl,
      hrefLabel: "Funder site",
      external: true,
    });
  }
  steps.push(
    { title: "Prepare required documents", done: docsReady, href: appHref, hrefLabel: "Workspace" },
    { title: "Answer the funder's questions — Cappo drafts", done: anyAnswers, href: appHref, hrefLabel: "Assistant" },
    { title: "Founder reviews & approves the copy", done: allApproved, href: appHref, hrefLabel: "Review answers" },
    { title: "Human approves for submission", done: humanApproved, href: appHref, hrefLabel: "Approval" },
    { title: "Submit on the funder's portal & record the confirmation #", done: submitted, href: appHref, hrefLabel: "Record submission" },
  );

  // The first not-yet-done step is the "current" one.
  const currentIdx = steps.findIndex((s) => !s.done);

  return (
    <ol className="flex flex-col gap-2">
      {steps.map((s, i) => {
        const current = i === currentIdx;
        return (
          <li
            key={s.title}
            className={`flex items-start gap-3 rounded-md border px-3 py-2 ${
              current ? "border-gold/50 bg-gold/5" : "border-border bg-panel-2"
            }`}
          >
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                s.done ? "bg-gold/20 text-gold" : current ? "border border-gold/60 text-gold" : "border border-border text-subtle"
              }`}
            >
              {s.done ? <Check size={13} /> : current ? i + 1 : <Circle size={7} className="fill-current" />}
            </span>
            <div className="flex flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div>
                <div className={`text-sm ${s.done ? "text-subtle line-through" : current ? "font-semibold text-fg" : "text-fg"}`}>
                  {i + 1}. {s.title}
                </div>
                {s.hint && !s.done && <div className="text-[11px] text-subtle">{s.hint}</div>}
              </div>
              {s.href && (
                s.external ? (
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-gold hover:underline">
                    {s.hrefLabel} <ExternalLink size={11} />
                  </a>
                ) : (
                  <Link href={s.href} className="text-xs font-semibold text-gold hover:underline">{s.hrefLabel} →</Link>
                )
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

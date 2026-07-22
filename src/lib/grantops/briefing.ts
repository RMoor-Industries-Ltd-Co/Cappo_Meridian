/**
 * GrantOps pre-application briefing — the "read before you agree to fill the forms"
 * content. Two parts, both pure/string-only:
 *   - buildFitAssessment: a deterministic "why this fits {entity}" read composed from
 *     scores, lane/entity alignment, award type, eligibility, and stored notes. Always
 *     available, no AI required.
 *   - buildBriefingPrompt: the prompt for an optional, richer AI-written brief.
 */

import { DOCUMENT_LABELS } from "./store";
import {
  daysUntil,
  riskFlags,
  type EntityProfile,
  type FundingOpportunity,
} from "./types";

export interface FitPoint {
  label: string;
  detail: string;
  tone: "pos" | "warn" | "info";
}

export interface FitAssessment {
  headline: string;
  points: FitPoint[];
}

/**
 * Deterministic fit read for the briefing view. No AI — composed from the scored,
 * structured record so it's always present and honest (never resolves a "verify").
 */
export function buildFitAssessment(
  o: FundingOpportunity,
  entity: EntityProfile | undefined,
): FitAssessment {
  const points: FitPoint[] = [];

  // Priority + recommendation.
  points.push({
    label: `Priority ${o.finalPriorityScore.toFixed(1)} · ${o.recommendation.replace(/_/g, " ")}`,
    detail: `ALLIE scores this Fit ${o.strategicFitScore}/10, Urgency ${o.urgencyScore}/10, Value ${o.fundingValueScore}/10, Probability ${o.probabilityScore}/10, minus Complexity drag ${o.complexityDrag}/10.`,
    tone: o.recommendation === "apply_now" ? "pos" : o.recommendation === "reject" ? "warn" : "info",
  });

  // Strategic-lane / entity alignment.
  const entName = entity?.entityName ?? o.bestApplicantEntity;
  const laneMatch = entity?.bestFundingLanes?.includes(o.strategicLane);
  points.push({
    label: `Fit for ${entName}`,
    detail: laneMatch
      ? `This grant's "${o.strategicLane.replace(/_/g, " ")}" lane is one of ${entName}'s best funding lanes — a direct strategic match.`
      : `This grant sits in the "${o.strategicLane.replace(/_/g, " ")}" lane. Confirm it aligns with ${entName}'s priorities before committing effort.`,
    tone: laneMatch ? "pos" : "info",
  });

  // Award type — is it non-dilutive cash?
  const cashy = o.awardType === "cash" || o.awardType === "reimbursement";
  points.push({
    label: `Award: ${o.awardType.replace(/_/g, " ")}`,
    detail: cashy
      ? "Non-dilutive capital — no equity given up."
      : o.awardType === "equity"
        ? "Potentially dilutive — weigh the equity cost before applying."
        : o.awardType === "loan"
          ? "This is a loan, not a grant — it must be repaid."
          : `${o.awardType.replace(/_/g, " ")} — confirm the value form fits the entity's needs.`,
    tone: cashy ? "pos" : "warn",
  });

  // Deadline pressure.
  const days = daysUntil(o.deadline);
  if (o.deadline && days !== null) {
    points.push({
      label: `Deadline in ${days} day${days === 1 ? "" : "s"}`,
      detail: `Due ${o.deadline.slice(0, 10)}.${days <= 14 ? " Tight window — prioritize document gathering immediately." : ""}`,
      tone: days <= 14 ? "warn" : "info",
    });
  }

  // Hard eligibility blockers.
  const blockers = riskFlags(o).filter((f) => f.severity === "block");
  points.push({
    label: blockers.length ? `${blockers.length} eligibility blocker${blockers.length === 1 ? "" : "s"}` : "No hard blockers flagged",
    detail: blockers.length
      ? `Resolve before investing effort: ${blockers.map((b) => b.label).join("; ")}.`
      : "No disqualifying eligibility flags detected — still verify anything marked 'verify' on the details below.",
    tone: blockers.length ? "warn" : "pos",
  });

  return {
    headline: `Why ${entName} should${o.recommendation === "reject" ? " NOT" : ""} pursue this`,
    points,
  };
}

/** Prompt for the optional AI-written brief. Returns prose only (no headings/preamble). */
export function buildBriefingPrompt(
  o: FundingOpportunity,
  entity: EntityProfile | undefined,
  knowledge?: string,
): string {
  const reqs = o.requiredDocuments.map((d) => DOCUMENT_LABELS[d] ?? d).join(", ") || "not specified";
  const ent = entity
    ? [
        `${entity.entityName} (${entity.entityCode}), a ${entity.entityType.replace(/_/g, " ")}.`,
        entity.description && `Description: ${entity.description}`,
        entity.summary && `Summary: ${entity.summary}`,
        entity.bio && `Bio: ${entity.bio}`,
        entity.bestFundingLanes?.length && `Best funding lanes: ${entity.bestFundingLanes.join(", ")}.`,
      ]
        .filter(Boolean)
        .join("\n")
    : `${o.bestApplicantEntity} (no detailed profile on file).`;

  return [
    `You are Cappo, AMG's operations engine, briefing a founder BEFORE they decide to spend time applying to a grant. Explain plainly whether and why this opportunity is a good fit for the applicant entity.`,
    "",
    "=== GRANT ===",
    `"${o.opportunityName}" from ${o.fundingOrganization}. Program: ${o.programType.replace(/_/g, " ")}; award: ${o.awardType.replace(/_/g, " ")}.`,
    o.fundingAmount ? `Amount: $${o.fundingAmount.toLocaleString()}.` : "Amount unspecified.",
    o.deadline ? `Deadline: ${o.deadline.slice(0, 10)}.` : "Rolling deadline.",
    `Strategic lane: ${o.strategicLane.replace(/_/g, " ")}. Required documents: ${reqs}.`,
    o.allieNotes && `ALLIE notes: ${o.allieNotes}`,
    o.cappoNotes && `CAPPO notes: ${o.cappoNotes}`,
    "",
    "=== APPLICANT ===",
    ent,
    knowledge ? "\n=== APPLICANT DOCUMENTS (from the entity's Drive knowledge folder) ===\n" + knowledge : "",
    "",
    "=== TASK ===",
    "Write a 200–350 word briefing covering: (1) why this fits (or doesn't) the entity's mission and stage, (2) the strongest angle to win it, (3) the realistic effort/requirements, and (4) any risks or 'verify-first' cautions. Ground every claim in the context above — do not invent facts. Return prose only, no headings or preamble.",
  ]
    .filter(Boolean)
    .join("\n");
}

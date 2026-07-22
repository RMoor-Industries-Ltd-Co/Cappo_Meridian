/**
 * GrantOps draft authoring — the prompts Cappo uses to pre-write the generic
 * grant-application sections (the "Application drafts" card) so a partner starts
 * from detailed, on-brand text instead of a blank box. Output is plain prose meant
 * to be copied out and refined by a human — nothing here is ever auto-submitted.
 *
 * Pure/string-only so it stays testable and free of server deps; the actions layer
 * (actions.ts) feeds these prompts to runCappoAgent and stores the result.
 */

import { DOCUMENT_LABELS } from "./store";
import { daysUntil, type EntityProfile, type FundingOpportunity } from "./types";

/** The draftable narrative sections, keyed by the GrantApplication field they fill. */
export const DRAFT_SECTIONS: { field: string; label: string; guidance: string }[] = [
  {
    field: "businessSummaryDraft",
    label: "Business summary",
    guidance:
      "A concise, compelling overview of the applicant entity: what it is, what it does, who it serves, traction/stage, and why it exists. 150–250 words.",
  },
  {
    field: "narrativeDraft",
    label: "Project narrative",
    guidance:
      "The core project/proposal narrative tailored to THIS funder's stated purpose: the problem, the approach, the outcomes, and why this entity is positioned to deliver. 250–400 words.",
  },
  {
    field: "useOfFundsDraft",
    label: "Use of funds",
    guidance:
      "A clear, itemized plan for how the award would be deployed, tied to concrete milestones/outcomes. Prefer categories with rough allocations. 150–250 words.",
  },
  {
    field: "budgetNarrativeDraft",
    label: "Budget narrative",
    guidance:
      "A prose justification of the budget: what the money buys and why each line is reasonable and necessary for the project's success. 150–250 words.",
  },
  {
    field: "impactStatementDraft",
    label: "Impact statement",
    guidance:
      "The measurable impact — economic, community, and mission — the award enables, aligned to the funder's priorities and the entity's strategic lane. 150–250 words.",
  },
  {
    field: "founderBioDraft",
    label: "Founder bio",
    guidance:
      "A credible founder/leadership bio establishing relevant experience, credentials, and the personal drive behind the entity. Use the entity's bio context. 120–200 words.",
  },
];

export const DRAFT_FIELD_SET = new Set(DRAFT_SECTIONS.map((s) => s.field));

export function draftLabel(field: string): string {
  return DRAFT_SECTIONS.find((s) => s.field === field)?.label ?? field;
}

/** Compact, human-readable context block about the applicant entity for the prompt. */
function entityContext(entity: EntityProfile | undefined, code: string): string {
  if (!entity) return `Applicant entity: ${code} (no detailed profile on file — keep claims generic and verifiable).`;
  const lines = [
    `Applicant entity: ${entity.entityName} (${entity.entityCode}), a ${entity.entityType.replace(/_/g, " ")}.`,
    entity.legalName && `Legal name: ${entity.legalName}.`,
    entity.description && `Description: ${entity.description}`,
    entity.summary && `Summary: ${entity.summary}`,
    entity.bio && `Bio / backstory: ${entity.bio}`,
    entity.approvedBusinessSummary && `Approved business summary: ${entity.approvedBusinessSummary}`,
    entity.defaultNarrative && `Default narrative: ${entity.defaultNarrative}`,
    entity.approvedUseOfFundsTemplate && `Use-of-funds template: ${entity.approvedUseOfFundsTemplate}`,
    entity.naicsCodes?.length ? `NAICS: ${entity.naicsCodes.join(", ")}.` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

/** Compact context block about the funding opportunity for the prompt. */
function opportunityContext(o: FundingOpportunity): string {
  const days = daysUntil(o.deadline);
  const reqs = o.requiredDocuments.map((d) => DOCUMENT_LABELS[d] ?? d).join(", ") || "not specified";
  return [
    `Grant: "${o.opportunityName}" from ${o.fundingOrganization}.`,
    `Program type: ${o.programType.replace(/_/g, " ")}; award type: ${o.awardType.replace(/_/g, " ")}.`,
    o.fundingAmount ? `Amount: $${o.fundingAmount.toLocaleString()}.` : "",
    o.deadline ? `Deadline: ${o.deadline.slice(0, 10)}${days !== null ? ` (${days} days out)` : ""}.` : "Rolling deadline.",
    `Strategic lane: ${o.strategicLane.replace(/_/g, " ")}.`,
    `Required documents: ${reqs}.`,
    o.allieNotes && `ALLIE research notes: ${o.allieNotes}`,
    o.cappoNotes && `CAPPO governance notes: ${o.cappoNotes}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Build the prompt for a single draft section. Instructs Cappo to return ONLY the
 * section prose (no preamble/headings) so it drops straight into the textarea.
 */
export function buildDraftPrompt(
  field: string,
  o: FundingOpportunity,
  entity: EntityProfile | undefined,
  knowledge?: string,
): string {
  const section = DRAFT_SECTIONS.find((s) => s.field === field);
  const label = section?.label ?? field;
  const guidance = section?.guidance ?? "Write this grant-application section clearly and specifically.";
  return [
    `You are Cappo, AMG's operations engine, pre-writing the "${label}" section of a grant application for a partner to review and refine.`,
    "",
    "=== GRANT ===",
    opportunityContext(o),
    "",
    "=== APPLICANT ===",
    entityContext(entity, o.bestApplicantEntity),
    knowledge ? "\n=== APPLICANT DOCUMENTS (from the entity's Drive knowledge folder) ===\n" + knowledge : "",
    "",
    "=== TASK ===",
    guidance,
    "",
    "Rules:",
    "- Return ONLY the section text — no headings, no preamble, no 'Here is…', no markdown fences.",
    "- Be specific and grounded ONLY in the context above. Do NOT invent numbers, dates, awards, or credentials that aren't provided; where a specific figure is genuinely needed but unknown, use a clearly-marked placeholder like [insert FY24 revenue].",
    "- Professional, confident, funder-appropriate tone. Ready to copy, paste, and refine.",
  ].join("\n");
}

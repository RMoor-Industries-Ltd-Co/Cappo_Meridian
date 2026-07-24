/**
 * GrantOps — Funding Command Center data model.
 *
 * Five core records (FundingOpportunity, EntityProfile, GrantDocument,
 * GrantApplication, GrantTask) plus the scoring + risk-flag logic that turns raw
 * opportunities into an executive decision queue for CAPPO (governance) and
 * ALLIE (research/prep).
 *
 * The data layer (store.ts) is an in-memory abstraction seeded from seed.ts so
 * the module runs everywhere today; it's structured to swap onto the app's
 * Postgres (lib/db.ts) later without touching the pages — see store.ts.
 */

// ─── Enums (as string unions) ──────────────────────────────────────────────

export type EntityCode = "AMG" | "HVN" | "3E" | "GovernanceIQ" | "RMI" | "RMG" | "Rahmel" | "Haneef" | "Multiple";

export type ProgramType =
  | "grant" | "loan" | "tax_credit" | "accelerator" | "pitch_competition"
  | "certification" | "technical_assistance" | "contract" | "in_kind_credit" | "other";

export type OpportunityStatus =
  | "discovered" | "researching" | "verified" | "scored" | "cappo_review"
  | "apply_now" | "verify_first" | "watchlist" | "rejected"
  | "application_workspace_created" | "drafting" | "submitted" | "awarded"
  | "denied" | "deferred" | "compliance_tracking";

export type AwardType = "cash" | "reimbursement" | "credit" | "in_kind" | "loan" | "equity" | "contract";

export type StrategicLane =
  | "technology" | "retail_ecommerce" | "creative_media" | "manufacturing"
  | "certification_contracting" | "local_atlanta" | "founder_capacity" | "other";

export type TriState = "yes" | "no" | "verify" | "not_applicable";
export type SourceReliability = "official" | "aggregator" | "needs_confirmation";
export type Complexity = "low" | "medium" | "high";
export type Recommendation = "apply_now" | "verify_first" | "watchlist" | "reject";
export type CappoDecision = "pending" | "approved_to_apply" | "rejected" | "deferred" | "more_info_needed";
export type HumanOwner = "Rahmel" | "Haneef" | "Both" | "Unassigned";
export type Outcome = "pending" | "awarded" | "denied" | "no_response" | "withdrawn";

export interface FundingOpportunity {
  id: string;
  opportunityName: string;
  fundingOrganization: string;
  programType: ProgramType;
  status: OpportunityStatus;
  deadline: string | null; // ISO date, or null for rolling
  rollingDeadline?: boolean;
  fundingAmount: number | null;
  awardType: AwardType;
  bestApplicantEntity: EntityCode;
  secondaryApplicantEntity?: EntityCode | null;
  strategicLane: StrategicLane;

  // Eligibility flags — TriState so "verify" is preserved, never assumed.
  blackMaleFounderEligible: TriState;
  blackOwnedEligible: TriState;
  minorityOwnedEligible: TriState;
  georgiaEligible: TriState;
  atlantaEligible: TriState;
  forProfitEligible: TriState;
  nonprofitRequired: TriState;
  womanOwnedRequired: TriState;
  veteranStatusRequired: TriState;
  physicalStorefrontRequired: TriState;
  revenueHistoryRequired: TriState;
  matchRequired: TriState;
  samGovRequired: TriState;
  mbeCertificationRequired: TriState;

  requiredDocuments: DocumentType[];
  applicationUrl?: string;
  sourceUrl?: string;
  verificationDate?: string | null;
  sourceReliability: SourceReliability;
  complexity: Complexity;

  // Scores 0–10; complexityDrag subtracts. See computeFinalPriority.
  strategicFitScore: number;
  urgencyScore: number;
  fundingValueScore: number;
  probabilityScore: number;
  complexityDrag: number;
  finalPriorityScore: number;

  recommendation: Recommendation;
  cappoDecision: CappoDecision;
  cappoNotes?: string;
  allieNotes?: string;
  // AI-written "why this fits {entity}" brief, generated on demand from the
  // pre-application briefing view (generateFitBriefingAction) and cached here.
  fitBriefing?: string | null;
  fitBriefingAt?: string | null;
  humanOwner: HumanOwner;
  submissionOwner?: HumanOwner | null;

  targetSubmissionDate?: string | null;
  submittedDate?: string | null;
  confirmationNumber?: string | null;
  followUpDate?: string | null;
  outcome: Outcome;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type EntityType = "holding_company" | "operating_company" | "founder" | "project" | "product_concept";
export type FundingRole = "coordinator" | "applicant" | "fiscal_sponsor_path" | "founder_applicant" | "not_primary_applicant";
export type ReadinessStatus = "ready" | "in_progress" | "not_started" | "n_a";

export interface EntityProfile {
  id: string;
  entityCode: EntityCode;
  entityName: string;
  entityType: EntityType;
  legalName: string;
  shortName: string;
  description: string;
  fundingRole: FundingRole;
  bestFundingLanes: StrategicLane[];
  einStatus: ReadinessStatus;
  stateRegistrationStatus: ReadinessStatus;
  operatingAgreementStatus: ReadinessStatus;
  bankAccountStatus: ReadinessStatus;
  website?: string;
  naicsCodes: string[];
  samGovStatus: ReadinessStatus;
  ueiStatus: ReadinessStatus;
  grantsGovStatus: ReadinessStatus;
  mbeCertificationStatus: ReadinessStatus;
  gmsdcStatus: ReadinessStatus;
  doasStatus: ReadinessStatus;
  sba8aStatus: ReadinessStatus;
  hubzoneStatus: ReadinessStatus;
  defaultFounder: HumanOwner;
  defaultNarrative?: string;
  approvedBusinessSummary?: string;
  approvedUseOfFundsTemplate?: string;
  // Persistent, copy/paste context a partner maintains for this entity — the
  // knowledge base Cappo reads when pre-writing grant drafts. Especially important
  // for the less-documented entities (3E, RMG, GovernanceIQ, and the two founders).
  summary?: string; // what the entity is / does — an elevator-to-executive summary
  bio?: string; // founder/leadership bio or entity backstory
  // Optional override: an existing Drive folder id this entity's knowledge lives in
  // (e.g. RMI → the shared "RECORDS BOOK" folder). When set, Cappo reads THIS folder
  // instead of auto-creating a subfolder under the knowledge root. See knowledge.ts.
  knowledgeFolderId?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type DocumentType =
  | "founder_bio" | "business_summary" | "ein_letter" | "state_registration"
  | "operating_agreement" | "bank_proof" | "naics_codes" | "pitch_deck"
  | "capability_statement" | "forecast_12_month" | "projection_3_year"
  | "projection_5_year" | "use_of_funds" | "budget" | "product_photos"
  | "headshot" | "tax_return" | "ownership_proof" | "minority_certification"
  | "project_plan" | "fiscal_sponsor_document" | "other";

export type DocumentStatus = "missing" | "draft" | "uploaded" | "approved" | "expired" | "needs_update";

export interface GrantDocument {
  id: string;
  documentName: string;
  documentType: DocumentType;
  relatedEntity: EntityCode;
  status: DocumentStatus;
  fileUrl?: string;
  expirationDate?: string | null;
  refreshFrequency?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ApplicationStatus =
  | "workspace_created" | "documents_gathering" | "narrative_drafting"
  | "budget_drafting" | "founder_review" | "final_assembly" | "ready_to_submit"
  | "submitted" | "follow_up" | "awarded" | "denied" | "compliance";

export interface ChecklistItem {
  documentType: DocumentType;
  label: string;
  done: boolean;
}

export interface GrantApplication {
  id: string;
  fundingOpportunityId: string;
  applicantEntity: EntityCode;
  applicationStatus: ApplicationStatus;
  driveFolderUrl?: string | null;
  applicationChecklist: ChecklistItem[];
  narrativeDraft?: string;
  founderBioDraft?: string;
  businessSummaryDraft?: string;
  projectSummaryDraft?: string;
  useOfFundsDraft?: string;
  budgetNarrativeDraft?: string;
  impactStatementDraft?: string;
  riskNotes?: string;
  humanApprovalRequired: boolean;
  approvedBy?: HumanOwner | null;
  submittedBy?: HumanOwner | null;
  submittedDate?: string | null;
  confirmationNumber?: string | null;
  followUpDate?: string | null;
  complianceRequirements?: string;
  notes?: string;
  // Set once the CAPPO-approval automation (Make webhook + ClickUp deadline tasks)
  // has fired for this application, so a re-approval never double-scaffolds it.
  automationFiredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskOwner = "ALLIE" | "CAPPO" | "Rahmel" | "Haneef" | "Admin";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "complete" | "canceled";
export type TaskType =
  | "verify_eligibility" | "gather_document" | "draft_narrative" | "draft_budget"
  | "cappo_review" | "founder_review" | "submit_application" | "save_confirmation"
  | "follow_up" | "compliance";

export interface GrantTask {
  id: string;
  relatedOpportunityId?: string | null;
  relatedApplicationId?: string | null;
  taskTitle: string;
  taskDescription?: string;
  owner: TaskOwner;
  dueDate?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  taskType: TaskType;
  createdAt: string;
  updatedAt: string;
}

// ─── Scoring ────────────────────────────────────────────────────────────────

export const SCORE_WEIGHTS = {
  strategicFit: 0.3,
  urgency: 0.25,
  fundingValue: 0.2,
  probability: 0.15,
  complexityDrag: 0.1,
} as const;

/** Final Priority = Fit·0.30 + Urgency·0.25 + Value·0.20 + Probability·0.15 − ComplexityDrag·0.10. */
export function computeFinalPriority(o: {
  strategicFitScore: number;
  urgencyScore: number;
  fundingValueScore: number;
  probabilityScore: number;
  complexityDrag: number;
}): number {
  const raw =
    o.strategicFitScore * SCORE_WEIGHTS.strategicFit +
    o.urgencyScore * SCORE_WEIGHTS.urgency +
    o.fundingValueScore * SCORE_WEIGHTS.fundingValue +
    o.probabilityScore * SCORE_WEIGHTS.probability -
    o.complexityDrag * SCORE_WEIGHTS.complexityDrag;
  return Math.round(raw * 100) / 100;
}

// ─── Risk flags ─────────────────────────────────────────────────────────────

export interface RiskFlag {
  key: string;
  label: string;
  severity: "block" | "warn" | "verify";
}

/**
 * Surfaces the disqualifiers/cautions a founder must see before pursuing an
 * opportunity — so bad-fit programs aren't re-worked repeatedly (business rules
 * 6–10, 14). "block" = likely ineligible, "warn" = pursue with care, "verify"
 * = confirm before investing effort.
 */
export function riskFlags(o: FundingOpportunity): RiskFlag[] {
  const flags: RiskFlag[] = [];
  if (o.programType === "loan" || o.awardType === "loan")
    flags.push({ key: "loan", label: "Loan — not a grant", severity: "warn" });
  if (o.awardType === "equity") flags.push({ key: "equity", label: "Potentially dilutive (equity)", severity: "warn" });
  if (o.programType === "accelerator")
    flags.push({ key: "accelerator", label: "Accelerator — confirm zero-equity", severity: "verify" });
  if (o.programType === "tax_credit")
    flags.push({ key: "tax_credit", label: "Tax credit — not cash", severity: "warn" });
  if (o.womanOwnedRequired === "yes") flags.push({ key: "woman", label: "Women-owned required", severity: "block" });
  if (o.nonprofitRequired === "yes") flags.push({ key: "nonprofit", label: "Nonprofit required", severity: "block" });
  if (o.forProfitEligible === "no") flags.push({ key: "forprofit", label: "For-profits ineligible", severity: "block" });
  if (o.veteranStatusRequired === "yes") flags.push({ key: "veteran", label: "Veteran status required", severity: "warn" });
  if (o.physicalStorefrontRequired === "yes")
    flags.push({ key: "storefront", label: "Physical storefront required", severity: "warn" });
  if (o.revenueHistoryRequired === "yes")
    flags.push({ key: "revenue", label: "Revenue history required", severity: "verify" });
  if (o.matchRequired === "yes") flags.push({ key: "match", label: "Match / cost-share required", severity: "warn" });
  if (o.samGovRequired === "yes") flags.push({ key: "sam", label: "SAM.gov / UEI required", severity: "verify" });
  if (o.mbeCertificationRequired === "yes")
    flags.push({ key: "mbe", label: "MBE certification required", severity: "verify" });
  if (o.georgiaEligible === "verify" || o.atlantaEligible === "verify")
    flags.push({ key: "geo", label: "Geography needs confirmation", severity: "verify" });
  if (o.status === "rejected" || o.recommendation === "reject")
    flags.push({ key: "closed", label: "Closed / do-not-pursue", severity: "block" });
  return flags;
}

/** Days until a deadline (negative = past). null when rolling / no deadline. */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
}

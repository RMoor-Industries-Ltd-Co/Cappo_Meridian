/**
 * GrantOps in-memory data layer.
 *
 * A single, process-local store seeded once from seed.ts. Every page/action
 * reads and writes through these functions — NOT the seed literals directly —
 * so swapping this file's internals onto Postgres (lib/db.ts) later is a
 * self-contained change that leaves the pages and server actions untouched.
 *
 * This is a single-container deploy with `dynamic = "force-dynamic"` pages, so
 * a module-level store is a legitimate operational state for this tool today.
 * State resets on redeploy — acceptable for a coordination/decision surface
 * whose source-of-truth records (Drive docs, confirmations) live elsewhere.
 */

import {
  computeFinalPriority,
  daysUntil,
  riskFlags,
  type CappoDecision,
  type FundingOpportunity,
  type EntityProfile,
  type GrantApplication,
  type GrantDocument,
  type GrantTask,
} from "./types";
import {
  SEED_DOCUMENTS,
  SEED_ENTITIES,
  SEED_OPPORTUNITIES,
  SEED_PROMPTS,
  type AiPrompt,
} from "./seed";

interface GrantOpsState {
  opportunities: FundingOpportunity[];
  entities: EntityProfile[];
  documents: GrantDocument[];
  applications: GrantApplication[];
  tasks: GrantTask[];
  seq: number;
}

// Deep-clone the seed so mutations never mutate the imported literals.
function freshState(): GrantOpsState {
  return {
    opportunities: SEED_OPPORTUNITIES.map((o) => ({ ...o })),
    entities: SEED_ENTITIES.map((e) => ({ ...e })),
    documents: SEED_DOCUMENTS.map((d) => ({ ...d })),
    applications: [],
    tasks: [],
    seq: 1,
  };
}

// Survive Next.js dev hot-reloads by stashing on globalThis.
const g = globalThis as unknown as { __grantops?: GrantOpsState };
function state(): GrantOpsState {
  if (!g.__grantops) g.__grantops = freshState();
  return g.__grantops;
}

// A monotonic, Date-free id (Date.now() is intentionally avoided in this repo's
// deterministic layers) — good enough for an in-memory store.
function nextId(prefix: string): string {
  const s = state();
  s.seq += 1;
  return `${prefix}-${s.seq}`;
}

// A stamp that's stable within a request without relying on a forbidden clock
// helper at module scope — new Date() is fine at call time inside a handler.
function stamp(): string {
  return new Date().toISOString();
}

// ─── Opportunities ───────────────────────────────────────────────────────────

export function listOpportunities(): FundingOpportunity[] {
  return [...state().opportunities].sort((a, b) => b.finalPriorityScore - a.finalPriorityScore);
}

export function getOpportunity(id: string): FundingOpportunity | undefined {
  return state().opportunities.find((o) => o.id === id);
}

export function createOpportunity(
  input: Partial<FundingOpportunity> & { opportunityName: string },
): FundingOpportunity {
  const now = stamp();
  const base: FundingOpportunity = {
    id: nextId("opp"),
    opportunityName: input.opportunityName,
    fundingOrganization: input.fundingOrganization ?? "",
    programType: input.programType ?? "grant",
    status: input.status ?? "discovered",
    deadline: input.deadline ?? null,
    rollingDeadline: input.rollingDeadline ?? false,
    fundingAmount: input.fundingAmount ?? null,
    awardType: input.awardType ?? "cash",
    bestApplicantEntity: input.bestApplicantEntity ?? "HVN",
    secondaryApplicantEntity: input.secondaryApplicantEntity ?? null,
    strategicLane: input.strategicLane ?? "other",
    blackMaleFounderEligible: input.blackMaleFounderEligible ?? "verify",
    blackOwnedEligible: input.blackOwnedEligible ?? "verify",
    minorityOwnedEligible: input.minorityOwnedEligible ?? "verify",
    georgiaEligible: input.georgiaEligible ?? "verify",
    atlantaEligible: input.atlantaEligible ?? "verify",
    forProfitEligible: input.forProfitEligible ?? "verify",
    nonprofitRequired: input.nonprofitRequired ?? "no",
    womanOwnedRequired: input.womanOwnedRequired ?? "no",
    veteranStatusRequired: input.veteranStatusRequired ?? "no",
    physicalStorefrontRequired: input.physicalStorefrontRequired ?? "no",
    revenueHistoryRequired: input.revenueHistoryRequired ?? "verify",
    matchRequired: input.matchRequired ?? "no",
    samGovRequired: input.samGovRequired ?? "no",
    mbeCertificationRequired: input.mbeCertificationRequired ?? "no",
    requiredDocuments: input.requiredDocuments ?? [],
    applicationUrl: input.applicationUrl,
    sourceUrl: input.sourceUrl,
    verificationDate: input.verificationDate ?? null,
    sourceReliability: input.sourceReliability ?? "needs_confirmation",
    complexity: input.complexity ?? "medium",
    strategicFitScore: input.strategicFitScore ?? 5,
    urgencyScore: input.urgencyScore ?? 5,
    fundingValueScore: input.fundingValueScore ?? 5,
    probabilityScore: input.probabilityScore ?? 5,
    complexityDrag: input.complexityDrag ?? 3,
    finalPriorityScore: 0,
    recommendation: input.recommendation ?? "verify_first",
    cappoDecision: input.cappoDecision ?? "pending",
    cappoNotes: input.cappoNotes,
    allieNotes: input.allieNotes,
    humanOwner: input.humanOwner ?? "Unassigned",
    submissionOwner: input.submissionOwner ?? null,
    targetSubmissionDate: input.targetSubmissionDate ?? null,
    submittedDate: input.submittedDate ?? null,
    confirmationNumber: input.confirmationNumber ?? null,
    followUpDate: input.followUpDate ?? null,
    outcome: input.outcome ?? "pending",
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
  base.finalPriorityScore = computeFinalPriority(base);
  state().opportunities.push(base);
  return base;
}

export function updateOpportunity(
  id: string,
  patch: Partial<FundingOpportunity>,
): FundingOpportunity | undefined {
  const o = getOpportunity(id);
  if (!o) return undefined;
  Object.assign(o, patch);
  o.finalPriorityScore = computeFinalPriority(o);
  o.updatedAt = stamp();
  return o;
}

/** CAPPO governance decision on an opportunity — human-in-the-loop gate. */
export function recordCappoDecision(
  id: string,
  decision: CappoDecision,
  notes?: string,
): FundingOpportunity | undefined {
  const o = getOpportunity(id);
  if (!o) return undefined;
  o.cappoDecision = decision;
  if (notes !== undefined) o.cappoNotes = notes;
  if (decision === "approved_to_apply" && o.status === "cappo_review") o.status = "apply_now";
  if (decision === "rejected") o.status = "rejected";
  if (decision === "deferred") o.status = "deferred";
  o.updatedAt = stamp();
  return o;
}

// ─── Entities ────────────────────────────────────────────────────────────────

export function listEntities(): EntityProfile[] {
  return [...state().entities];
}
export function getEntity(id: string): EntityProfile | undefined {
  return state().entities.find((e) => e.id === id);
}
/** Look up an entity profile by its EntityCode (e.g. "HVN") — used to build draft context. */
export function getEntityByCode(code: string): EntityProfile | undefined {
  return state().entities.find((e) => e.entityCode === code);
}
export function updateEntity(id: string, patch: Partial<EntityProfile>): EntityProfile | undefined {
  const e = getEntity(id);
  if (!e) return undefined;
  Object.assign(e, patch);
  e.updatedAt = stamp();
  return e;
}

// ─── Documents ───────────────────────────────────────────────────────────────

export function listDocuments(): GrantDocument[] {
  return [...state().documents];
}
export function createDocument(
  input: Partial<GrantDocument> & { documentName: string },
): GrantDocument {
  const now = stamp();
  const doc: GrantDocument = {
    id: nextId("doc"),
    documentName: input.documentName,
    documentType: input.documentType ?? "other",
    relatedEntity: input.relatedEntity ?? "AMG",
    status: input.status ?? "missing",
    fileUrl: input.fileUrl,
    expirationDate: input.expirationDate ?? null,
    refreshFrequency: input.refreshFrequency,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
  state().documents.push(doc);
  return doc;
}
export function updateDocument(id: string, patch: Partial<GrantDocument>): GrantDocument | undefined {
  const d = state().documents.find((x) => x.id === id);
  if (!d) return undefined;
  Object.assign(d, patch);
  d.updatedAt = stamp();
  return d;
}

// ─── Applications ────────────────────────────────────────────────────────────

export function listApplications(): GrantApplication[] {
  return [...state().applications];
}
export function getApplication(id: string): GrantApplication | undefined {
  return state().applications.find((a) => a.id === id);
}
export function getApplicationForOpportunity(oppId: string): GrantApplication | undefined {
  return state().applications.find((a) => a.fundingOpportunityId === oppId);
}

/**
 * Open (or return the existing) application workspace for an opportunity. The
 * checklist is derived from the opportunity's requiredDocuments so the prep
 * work is explicit. humanApprovalRequired is TRUE by default and never cleared
 * automatically — no external submission happens without a human approving.
 */
export function createApplication(oppId: string): GrantApplication | undefined {
  const existing = getApplicationForOpportunity(oppId);
  if (existing) return existing;
  const o = getOpportunity(oppId);
  if (!o) return undefined;
  const now = stamp();
  const app: GrantApplication = {
    id: nextId("app"),
    fundingOpportunityId: oppId,
    applicantEntity: o.bestApplicantEntity,
    applicationStatus: "workspace_created",
    driveFolderUrl: null,
    applicationChecklist: o.requiredDocuments.map((dt) => ({
      documentType: dt,
      label: DOCUMENT_LABELS[dt] ?? dt,
      done: false,
    })),
    humanApprovalRequired: true,
    approvedBy: null,
    submittedBy: null,
    submittedDate: null,
    confirmationNumber: null,
    followUpDate: null,
    automationFiredAt: null,
    createdAt: now,
    updatedAt: now,
  };
  state().applications.push(app);
  if (o.status === "apply_now" || o.status === "verify_first")
    updateOpportunity(oppId, { status: "application_workspace_created" });
  return app;
}

export function updateApplication(
  id: string,
  patch: Partial<GrantApplication>,
): GrantApplication | undefined {
  const a = getApplication(id);
  if (!a) return undefined;
  Object.assign(a, patch);
  a.updatedAt = stamp();
  return a;
}

export function toggleChecklistItem(appId: string, documentType: string, done: boolean) {
  const a = getApplication(appId);
  if (!a) return undefined;
  const item = a.applicationChecklist.find((c) => c.documentType === documentType);
  if (item) item.done = done;
  a.updatedAt = stamp();
  return a;
}

/**
 * Mark an application as human-approved for submission. This is the ONLY path
 * that clears the human-approval gate, and it records WHO approved. It still
 * does not submit anything — submission stays a manual, off-platform human act
 * whose confirmation number is recorded afterward.
 */
export function approveApplication(id: string, approver: GrantApplication["approvedBy"]) {
  const a = getApplication(id);
  if (!a) return undefined;
  a.humanApprovalRequired = false;
  a.approvedBy = approver;
  a.applicationStatus = "ready_to_submit";
  a.updatedAt = stamp();
  return a;
}

export function recordSubmission(
  id: string,
  by: GrantApplication["submittedBy"],
  confirmationNumber: string,
) {
  const a = getApplication(id);
  if (!a) return undefined;
  a.submittedBy = by;
  a.submittedDate = stamp();
  a.confirmationNumber = confirmationNumber;
  a.applicationStatus = "submitted";
  a.updatedAt = stamp();
  updateOpportunity(a.fundingOpportunityId, {
    status: "submitted",
    submittedDate: a.submittedDate,
    confirmationNumber,
    submissionOwner: by,
  });
  return a;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export function listTasks(): GrantTask[] {
  return [...state().tasks];
}
export function createTask(input: Partial<GrantTask> & { taskTitle: string }): GrantTask {
  const now = stamp();
  const t: GrantTask = {
    id: nextId("task"),
    relatedOpportunityId: input.relatedOpportunityId ?? null,
    relatedApplicationId: input.relatedApplicationId ?? null,
    taskTitle: input.taskTitle,
    taskDescription: input.taskDescription,
    owner: input.owner ?? "ALLIE",
    dueDate: input.dueDate ?? null,
    priority: input.priority ?? "medium",
    status: input.status ?? "todo",
    taskType: input.taskType ?? "verify_eligibility",
    createdAt: now,
    updatedAt: now,
  };
  state().tasks.push(t);
  return t;
}
export function updateTask(id: string, patch: Partial<GrantTask>): GrantTask | undefined {
  const t = state().tasks.find((x) => x.id === id);
  if (!t) return undefined;
  Object.assign(t, patch);
  t.updatedAt = stamp();
  return t;
}

// ─── Prompt library ──────────────────────────────────────────────────────────

export function listPrompts(): AiPrompt[] {
  return [...SEED_PROMPTS];
}

// ─── Derived / dashboard queries ─────────────────────────────────────────────

export interface DashboardSummary {
  totalOpportunities: number;
  applyNow: number;
  verifyFirst: number;
  watchlist: number;
  pendingCappoReview: number;
  openApplications: number;
  submitted: number;
  potentialCashValue: number;
  closingSoon: FundingOpportunity[]; // deadline within 21 days
  topPriorities: FundingOpportunity[];
}

export function dashboardSummary(): DashboardSummary {
  const opps = listOpportunities();
  const closingSoon = opps
    .filter((o) => {
      const d = daysUntil(o.deadline);
      return d !== null && d >= 0 && d <= 21 && o.status !== "rejected" && o.outcome === "pending";
    })
    .sort((a, b) => (daysUntil(a.deadline) ?? 0) - (daysUntil(b.deadline) ?? 0));
  const cashOpps = opps.filter(
    (o) => (o.awardType === "cash" || o.awardType === "reimbursement") && o.recommendation !== "reject",
  );
  return {
    totalOpportunities: opps.length,
    applyNow: opps.filter((o) => o.recommendation === "apply_now").length,
    verifyFirst: opps.filter((o) => o.recommendation === "verify_first").length,
    watchlist: opps.filter((o) => o.recommendation === "watchlist").length,
    pendingCappoReview: opps.filter(
      (o) => o.cappoDecision === "pending" && o.recommendation !== "reject",
    ).length,
    openApplications: state().applications.filter(
      (a) => a.applicationStatus !== "submitted" && a.applicationStatus !== "awarded" && a.applicationStatus !== "denied",
    ).length,
    submitted: state().applications.filter((a) => a.applicationStatus === "submitted").length,
    potentialCashValue: cashOpps.reduce((sum, o) => sum + (o.fundingAmount ?? 0), 0),
    closingSoon: closingSoon.slice(0, 6),
    topPriorities: opps.slice(0, 6),
  };
}

/** The CAPPO review queue: scored opportunities still awaiting a governance call. */
export function reviewQueue(): FundingOpportunity[] {
  return listOpportunities().filter(
    (o) => o.cappoDecision === "pending" && o.recommendation !== "reject",
  );
}

export interface CalendarEntry {
  opportunity: FundingOpportunity;
  deadline: string;
  days: number;
}

/** Upcoming, dated deadlines (ignores rolling / null), soonest first. */
export function fundingCalendar(): CalendarEntry[] {
  return listOpportunities()
    .filter((o) => o.deadline && o.status !== "rejected")
    .map((o) => ({ opportunity: o, deadline: o.deadline as string, days: daysUntil(o.deadline) ?? 0 }))
    .sort((a, b) => a.days - b.days);
}

/** Convenience re-export so pages import risk logic from the store barrel. */
export { riskFlags, daysUntil };

// Human-readable labels for checklist rows (kept here so the store owns the map).
const DOCUMENT_LABELS: Record<string, string> = {
  founder_bio: "Founder bio",
  business_summary: "Business summary",
  ein_letter: "EIN letter",
  state_registration: "State registration",
  operating_agreement: "Operating agreement",
  bank_proof: "Bank account proof",
  naics_codes: "NAICS codes",
  pitch_deck: "Pitch deck",
  capability_statement: "Capability statement",
  forecast_12_month: "12-month forecast",
  projection_3_year: "3-year projection",
  projection_5_year: "5-year projection",
  use_of_funds: "Use of funds",
  budget: "Budget",
  product_photos: "Product photos",
  headshot: "Headshot",
  tax_return: "Tax return",
  ownership_proof: "Ownership proof",
  minority_certification: "Minority certification",
  project_plan: "Project plan",
  fiscal_sponsor_document: "Fiscal sponsor document",
  other: "Other document",
};

export { DOCUMENT_LABELS };
